import logging, threading
from .rpunct import RestorePuncts

log = logging.getLogger(__name__)
model = None
lock = threading.Lock()

def load():
	global model
	try: model = RestorePuncts()
	except Exception: log.exception("Punctuation model failed to load; runnign without it.")

def apply(text: str) -> str:
	if model is None or not text.strip(): return text
	try:
		with lock: out = model.punctuate(text) # one forward pass across sessions
		return out.replace(";", ",").replace(":", ",")
	except Exception:
		log.exception("Punctuation failed; returning raw text")
		return text
