"""Model text -> JSON. Light repair only (code fences, prose around the object, trailing commas);
the Pydantic validation that follows is what decides."""

import json
import re

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)
_TRAILING_COMMA = re.compile(r",\s*([}\]])")


def parse_model_json(raw: str):
    text = _FENCE.sub("", raw.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        block = _first_object(text)
        if block is None:
            raise ValueError("The model did not return JSON") from None
        return json.loads(_TRAILING_COMMA.sub(r"\1", block))


def _first_object(text: str) -> str | None:
    """The first balanced {...} block, ignoring braces inside strings."""
    start = text.find("{")
    if start < 0:
        return None
    depth, in_string, escaped = 0, False, False
    for i in range(start, len(text)):
        c = text[i]
        if in_string:
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == '"':
                in_string = False
        elif c == '"':
            in_string = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None
