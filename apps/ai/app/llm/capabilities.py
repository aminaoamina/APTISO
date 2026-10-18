"""What each AI feature asks of the model. Features name a capability, never a model."""

from dataclasses import dataclass
from typing import Literal

ModelRole = Literal["main", "fallback", "embed", "ocr", "vision"]


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
    "document_review": Capability(_FAST, 0.1, 4000, 120, 2, True, True),
    "evidence_analyze": Capability(_FAST, 0.1, 1500, 120, 2, True, False),
    "next_actions": Capability(_FAST, 0.2, 800, 25, 1, True, False),
}
