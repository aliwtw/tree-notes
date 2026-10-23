import os, re

ASR_DIR = os.getenv("ASR_DIR")
ASR_DEFAULT_MODEL = os.getenv("ASR_DEFAULT_MODEL")
DEFAULT_SAMPLE_RATE = 16000 # kaldi expects 16kHz mono 16-bit PCM
SAFE_NAME = re.compile(r"^[A-Za-z0-9_-]+$")
ASR_URL = os.getenv("ASR_URL")
