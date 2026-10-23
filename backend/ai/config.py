import requests, json, subprocess, os

OLLAMA_URL = os.getenv("OLLAMA_URL")
SMALL_MODEL = os.getenv("SMALL_MODEL_NAME")
LARGE_MODEL = os.getenv("LARGE_MODEL_NAME")
EXPLICIT_MODEL = os.getenv("OLLAMA_MODEL")

ACTIVE_MODEL = SMALL_MODEL

### WARM UP OLLAMA ---> PRELOAD

def detect_vram_gb():
    try:
        output = subprocess.check_output(
            ["docker", "exec", "ollama", "nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"]
        )
        return int(output.decode().strip()) // 1024
    except Exception:
        return 0

def warm_ollama():
    global ACTIVE_MODEL

    if EXPLICIT_MODEL:
        ACTIVE_MODEL = EXPLICIT_MODEL
    else:
        if detect_vram_gb() >= 12:
            ACTIVE_MODEL = LARGE_MODEL

    resp = requests.post(OLLAMA_URL, json={
        "model": ACTIVE_MODEL,
        "prompt": "Warm-up prompt",
        "stream": False
    })
    _ = resp.json() # forces Ollama to load fully

    return
