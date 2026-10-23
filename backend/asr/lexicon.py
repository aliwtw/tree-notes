import json, os, re, tempfile

from threading import Lock
from backend.asr.config import ASR_DIR

PATH = os.path.join(ASR_DIR, "lexicon.json")	# persistence inside the docker volume
lock = Lock()
entries: dict[str, list[str]] = {}	# term: phrase Vosk wrongly writes
rules: list[tuple[re.Pattern, str]] = []

def compiler() -> None:
	global rules
	pairs = [(p, term) for term, phrases in entries.items() for p in phrases]
	pairs.sort(key=lambda pair: len(pair[0]), reverse=True)	# get longest phrase first
	rules = [
		(re.compile(r"\b" + r"\s+".join(map(re.escape, p.split())) + r"\b", re.IGNORECASE), term)
		for p, term in pairs
	]

def load() -> None:
	global entries
	if os.path.exists(PATH):
		with open(PATH, encoding="utf-8") as f:
			entries = json.load(f)
	compiler()

def spoken_variants(term: str) -> list[str]:
	# "NLP" -> ["n l p"]; only for short all-caps acronyms
	term = term.strip()
	if term.isalpha() and 2 <= len(letters) <= 6:
		return [" ".join(letters.lower())]
	return []

def save() -> None:
	fd, tmp = tempfile.mkstemp(dir=ASR_DIR)
	with os.fdopen(fd, "w", encoding="utf-8") as f:
		json.dump(entries, f, indent=2)
	os.replace(tmp, PATH)	# atomic, so a crash can't leave a half-written file

def all_entries() -> dict[str, list[str]]:
	return dict(entries)

def add(term: str, heard_as: list[str]) -> None:
	phrases = [p.lower().strip() for p in heard_as if p.strip()]
	phrases = list(dict.fromkeys(spoken_variants(term) + phrases)) # dedupe but maintain order (TERM is capitalised)
	# if not phrases:
	# 	raise ValueError("Can't guess how this term sounds, provide heard_as")
	with lock:
		entries[term] = phrases # might be empty
		save()
		compiler()

def remove(term: str) -> bool:
	with lock:
		key = next((k for k in entries if k.lower() == term.lower()), None)
		if key is None: return False
		del entries[term]
		save()
		compiler()
		return True

def apply(text: str) -> str:
	for pattern, term in rules:
		text = pattern.sub(lambda m, t=term: t, text)
	return text
