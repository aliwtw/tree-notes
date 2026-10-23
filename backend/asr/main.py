import asyncio, json, logging, os#, re
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from vosk import Model, KaldiRecognizer

from . import punctuation
from backend.asr import lexicon
from backend.asr.schemas import LexiconEntry
from backend.asr.config import ASR_DIR, ASR_DEFAULT_MODEL, DEFAULT_SAMPLE_RATE, SAFE_NAME

log = logging.getLogger("uvicorn.error")

# load vosk model objects are read-only, one per language
# shared across all connections
# only Kaldi Recognizer needs to be recreated each WebSocket
models : dict[str, Model] = {}

# the browser must resample and convert to int16 for kaldi
# DEFAULT_SAMPLE_RATE = 16000 # kaldi expects 16kHz mono 16-bit PCM
# SAFE_NAME = re.compile(r"^[A-Za-z0-9_-]+$")

def load_model(name:str) -> Model:
	path = os.path.join(ASR_DIR, name)
	if not SAFE_NAME.match(name) or not os.path.isdir(path):
		raise ValueError(f"Unknown ASR model '{name}'")
	return Model(path)

async def get_model(name: str) -> Model:
	if name not in models:
		# loading is slow and blocking, keep it off the event loop
		models[name] = await asyncio.to_thread(load_model, name)
	return models[name]

async def corrected(raw: str, final: bool = False) -> dict:
	payload = json.loads(raw)
	for key in ("text", "partial"):
		if key in payload: payload[key] = lexicon.apply(payload[key])
	if final and payload.get("text"):
		payload["text"] = await asyncio.to_thread(punctuation.apply, payload["text"])
	return payload

@asynccontextmanager
async def lifespan(app:FastAPI):
	log.info(f"Loading default ASR model: {ASR_DEFAULT_MODEL}")
	models[ASR_DEFAULT_MODEL] = Model(f"{ASR_DIR}/{ASR_DEFAULT_MODEL}")
	lexicon.load()
	log.info("Loading punctuation model")
	await asyncio.to_thread(punctuation.load)
	yield
	models.clear()

app = FastAPI(title="TreeNotes ASR", lifespan=lifespan)

@app.get("/health", tags=["meta"])
def health() -> dict: return {"status": "ok", "loaded_models": list(models.keys())}

@app.websocket("/")
@app.websocket("/ws")
async def transcribe(websocket: WebSocket):
	await websocket.accept()
	try:
		# first message from the client picks the language before any audio
		init = await websocket.receive_json()
		config = init.get("config", {})
		sample_rate = int(config.get("sample_rate", DEFAULT_SAMPLE_RATE))
		language = config.get("language", ASR_DEFAULT_MODEL)
		log.info(f"ASR Session: model={language} sample_rate={sample_rate}")
		recognizer = KaldiRecognizer(await get_model(language), sample_rate)

		while True:
			message = await websocket.receive()
			if message["type"] == "websocket.disconnect": break
			if message.get("bytes") is not None:
				done = await asyncio.to_thread(recognizer.AcceptWaveform, message["bytes"])
				result = recognizer.Result() if done else recognizer.PartialResult()
				await websocket.send_json(await corrected(result, final=done))
			elif message.get("text"):
				if json.loads(message["text"]).get("eof"):
					await websocket.send_json(await corrected(recognizer.FinalResult(), final=True))
					await websocket.close()
					break
	except WebSocketDisconnect: pass
	except Exception as exc:
		log.exception("ASR session failed")
		try:
			await websocket.send_json({"error": str(exc)})
			await websocket.close()
		except Exception: pass

@app.get("/lexicon", tags=["lexicon"])
def list_terms() -> dict:
	return lexicon.all_entries()

@app.post("/lexicon", tags=["lexicon"])
def add_term(entry: LexiconEntry) -> dict:
	try:
		lexicon.add(entry.term, entry.heard_as)
	except ValueError as exc:
		raise HTTPException(status_code=400, detail=str(exc))
	return lexicon.all_entries()

@app.delete("/lexicon/{term}", tags=["lexicon"])
def delete_term(term: str) -> dict:
	if not lexicon.remove(term):
		raise HTTPException(status_code=404, detail="Term not found")
	return lexicon.all_entries()

