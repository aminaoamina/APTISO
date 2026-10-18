"""What each AI feature asks of the model. Features name a capability, never a model."""

from dataclasses import dataclass
from typing import Literal

ModelRole = Literal["main", "fallback", "embed", "ocr", "ocr_fallback", "vision"]


@dataclass(frozen=True)
class Capability:
    models: tuple[ModelRole, ...]  # tried in order
    temperature: float
    max_tokens: int
    timeout_s: float
    retries: int  # extra attempts per model, on transient errors only
    json: bool
    thinking: bool  # reasoning costs ~4x the latency: only where quality needs it


_FAST: tuple[ModelRole, ...] = ("main", "fallback")

CAPABILITIES: dict[str, Capability] = {
    "health": Capability(_FAST, 0, 20, 20, 0, False, False),
    "wizard_suggest": Capability(_FAST, 0.2, 3000, 40, 1, True, True),
    "paragraph_improve": Capability(_FAST, 0.3, 1200, 30, 0, False, False),
    "companion_chat": Capability(_FAST, 0.3, 1500, 45, 0, False, False),
    "document_review": Capability(_FAST, 0.1, 4000, 90, 1, True, True),
    "evidence_analyze": Capability(_FAST, 0.1, 1500, 90, 1, True, False),
    # Reading a page image; the second reading (cross-check) uses the other models.
    "evidence_ocr": Capability(("ocr", "ocr_fallback", "vision"), 0, 3000, 60, 1, False, False),
    "evidence_ocr_check": Capability(("ocr_fallback", "vision"), 0, 3000, 60, 1, False, False),
    "next_actions": Capability(_FAST, 0.2, 800, 25, 1, True, False),
    "weekly_digest": Capability(_FAST, 0.5, 1500, 45, 1, True, False),
}
