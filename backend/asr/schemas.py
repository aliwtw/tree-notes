from pydantic import BaseModel, Field

class LexiconEntry(BaseModel):
	term: str = Field(min_length=1, max_length=64) 						# what should appear in text form e.g. "NLP"
	heard_as: list[str] = Field(default_factory=list, max_length=20)	# what vosk writes instead
