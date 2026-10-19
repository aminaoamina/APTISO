"""ISO/IEC 27001:2022 reference catalog: clauses 4-10 and the 93 Annex A controls.

Every clause or control ID the AI returns is resolved here. Anything else,
such as a 2013 number like A.12.3.1, is rejected.
"""

import json
import re
from pathlib import Path

_DATA = json.loads((Path(__file__).parent / "iso27001_2022.json").read_text(encoding="utf-8"))

VERSION: str = _DATA["version"]
CLAUSES: dict[str, str] = {c["ref"]: c["title"] for c in _DATA["clauses"]}
CONTROLS: dict[str, str] = {c["ref"]: c["title"] for c in _DATA["controls"]}
# What an auditor checks for each clause (the internal audit checklist questions).
CLAUSE_QUESTIONS: dict[str, str] = {c["ref"]: c["question"] for c in _DATA["clauses"]}
# APTISO's own implementation guides (objective, auditor expectations, evidence, pitfalls), written in its own words.
_GUIDES_FILE = Path(__file__).parent / "guides.json"
_GUIDES = json.loads(_GUIDES_FILE.read_text(encoding="utf-8")) if _GUIDES_FILE.exists() else {"version": "none", "items": {}}
GUIDES: dict[str, dict] = _GUIDES["items"]
# Version of the shared ISO knowledge (catalog + guides): a change re-indexes it.
KNOWLEDGE_VERSION = f"{VERSION}+{_GUIDES['version'].replace('guides@', 'g')}"[:20]
_BY_TITLE = {t.lower(): r for r, t in {**CLAUSES, **CONTROLS}.items()}
_REF = re.compile(r"^(?:clause|control)?\s*(a)?[\s.]*(\d+(?:\.\d+)*)", re.IGNORECASE)


def title(ref: str) -> str | None:
    return CLAUSES.get(ref) or CONTROLS.get(ref)


def resolve(value: str) -> str | None:
    """'A.5.15', 'a 5.15', '5.15' or 'Access control' -> 'A.5.15'; '9.2.2' -> '9.2.2'. None if not in ISO/IEC 27001:2022."""
    raw = value.strip()
    if raw.lower() in _BY_TITLE:
        return _BY_TITLE[raw.lower()]
    m = _REF.match(raw)
    if not m:
        return None
    annex, num = m.groups()
    if annex:
        return f"A.{num}" if f"A.{num}" in CONTROLS else None
    # Clauses first (5.1 is a clause; 9.2.2 is a sub-clause of 9.2), else a bare control number such as 5.15.
    parts = num.split(".")
    if any(".".join(parts[:n]) in CLAUSES for n in range(len(parts), 1, -1)):
        return num
    return f"A.{num}" if f"A.{num}" in CONTROLS else None


def resolve_all(values: list[str]) -> tuple[list[str], list[str]]:
    """The IDs found, and one error per value that is not in the standard."""
    refs, errors = [], []
    for v in values:
        ref = resolve(v)
        if ref:
            refs.append(ref)
        else:
            errors.append(f'"{v}" is not an ISO/IEC 27001:2022 clause or Annex A control')
    return list(dict.fromkeys(refs)), errors
