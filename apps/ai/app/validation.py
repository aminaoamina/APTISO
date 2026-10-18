"""Deterministic checks on AI answers: quotes must exist in the source, names must not come from nowhere."""

import re

_SPACES = re.compile(r"\s+")
# Acronyms (AWS, GDPR), names with digits (Microsoft 365, ISO 9001), numbers (72, 99.9) and
# capitalised words inside a sentence (Azure, Salesforce): the facts most often invented.
_ENTITY = re.compile(r"\b[A-Z]{2,}[a-z]*\d*\b|\b[A-Z][a-z]+ \d+\b|\b\d+(?:[.,]\d+)?%?|(?<=[a-z,;] )[A-Z][a-zA-Z]+\b")
# Generic terms any ISMS document may use without a source.
_GENERIC = {"isms", "iso", "iec", "it", "hr", "saas", "ict", "pii", "the", "a", "an"}


def normalize(s: str) -> str:
    s = s.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    return _SPACES.sub(" ", s).strip().lower()


def quote_in(source: str, quote: str) -> bool:
    """Whether `quote` appears word for word in `source` (spacing, case and typographic quotes ignored)."""
    return bool(quote.strip()) and normalize(quote) in normalize(source)


def unsupported_names(answer: str, sources: str) -> list[str]:
    """Names, acronyms and numbers in the answer that appear nowhere in the sources."""
    known = normalize(sources)
    found = dict.fromkeys(m.group(0).strip() for m in _ENTITY.finditer(answer))
    return [e for e in found if e.lower() not in _GENERIC and normalize(e) not in known]
