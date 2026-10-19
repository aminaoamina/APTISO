"""Evidence reading: extract the text of a PDF or image (text layer first, OCR only for scanned pages),
then propose a summary, the controls it may prove and its expiry date. The code keeps only verifiable proposals."""

import base64
import math
import re
from collections import Counter
from datetime import date

import pymupdf
from pydantic import BaseModel, Field

from app import catalog
from app.llm.client import AiClient, AiRejected, AiUnavailable, RunMeta
from app.prompts import Prompt
from app.validation import quote_in

MAX_PAGES = 10
MAX_OCR_PAGES = 6
MIN_TEXT = 40  # characters: below this a page is treated as a scan, and an OCR reading as failed
DPI = 180
MAX_TEXT = 20_000
CANDIDATES = 15
FILE_TYPES = {"application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpeg", "image/jpg": "jpeg", "image/webp": "webp"}

OCR = Prompt("evidence-ocr", 1, "You transcribe scanned documents. Copy every word exactly, in reading order. Render tables as Markdown tables. Output only the transcription, without comments.")
OCR_STRICT = Prompt("evidence-ocr", 2, "You transcribe scanned documents. Copy EVERY word, number and date exactly as printed, in reading order, including headers, footers and table cells. Render tables as Markdown tables. Output only the transcription.")

EVIDENCE_ANALYSIS = Prompt(
    "evidence-analysis",
    1,
    """You read a piece of evidence uploaded to an ISO/IEC 27001:2022 management system (a report, log, record, certificate, screenshot...).
- "summary": two or three sentences saying what the document is and what it shows (results, dates, failures), using only its content.
- "document_type": a few words, for example "backup report", "training attendance list", "penetration test report".
- "suggested": the controls or clauses from the <candidates> list that this document is evidence for, at most 5, the strongest first, each with a short reason based on the document. Use only ids from the list; an empty list is fine.
- "expiry": if the document states until when it is valid (an expiry, validity or next review date), give that date as YYYY-MM-DD and the exact sentence that states it, copied word for word. Otherwise null. Never infer a date.""",
)

_WORD = re.compile(r"[a-z]{4,}")
_STOP = {"information", "security", "management", "system", "systems", "organization", "with", "from", "that", "this", "their", "where", "into", "other", "data"}


class EvidenceFile(BaseModel):
    name: str = Field(max_length=255)
    mime: str = Field(max_length=150)
    sha256: str = Field(min_length=64, max_length=64)
    data: str  # base64; removed from the job once the analysis is over


class EvidenceInfo(BaseModel):
    id: str = Field(max_length=64)
    title: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=3000)


class EvidencePayload(BaseModel):
    evidence: EvidenceInfo
    file: EvidenceFile


class Suggested(BaseModel):
    ref: str
    reason: str


class Expiry(BaseModel):
    date: str
    quote: str


class Analysis(BaseModel):
    summary: str
    document_type: str
    suggested: list[Suggested]
    expiry: Expiry | None


# ─── Extraction ──────────────────────────────────────────────────

async def _read_image(ai: AiClient, png: bytes, meta: RunMeta, capability: str, prompt: Prompt) -> str:
    url = "data:image/png;base64," + base64.b64encode(png).decode()
    content = [{"type": "text", "text": "Transcribe this page."}, {"type": "image_url", "image_url": {"url": url}}]
    text, _, _ = await ai.text(capability, prompt, [{"role": "user", "content": content}], meta)
    return text.strip()


async def _ocr(ai: AiClient, png: bytes, meta: RunMeta) -> tuple[str, bool]:
    """One reading; if it looks wrong (almost no text), a second, stricter reading by other models. Returns (text, second reading used)."""
    try:
        first = await _read_image(ai, png, meta, "evidence_ocr", OCR)
    except AiUnavailable:
        first = ""
    if len(first) >= MIN_TEXT:
        return first, False
    try:
        second = await _read_image(ai, png, meta, "evidence_ocr_check", OCR_STRICT)
    except AiUnavailable:
        second = ""
    return (second if len(second) > len(first) else first), True


async def extract(ai: AiClient, file: EvidenceFile, meta: RunMeta) -> dict:
    """The document's text: each page's own text layer, OCR only where a page has none (scans, photos, images)."""
    doc = pymupdf.open(stream=base64.b64decode(file.data), filetype=FILE_TYPES[file.mime])
    pages, ocr_pages, second_readings = [], 0, 0
    for page in list(doc)[:MAX_PAGES]:
        text = page.get_text().strip()
        if len(text) < MIN_TEXT and ocr_pages < MAX_OCR_PAGES:
            text, second = await _ocr(ai, page.get_pixmap(dpi=DPI).tobytes("png"), meta)
            ocr_pages += 1
            second_readings += second
        pages.append(text)
    return {"text": "\n\n".join(p for p in pages if p)[:MAX_TEXT], "pages": doc.page_count, "ocr_pages": ocr_pages, "second_readings": second_readings}


# ─── Analysis ────────────────────────────────────────────────────

def _words(value: str) -> set[str]:
    return {w.rstrip("s") for w in _WORD.findall(value.lower())} - _STOP


_ENTRIES = {**{r: f"{t} {catalog.CLAUSE_QUESTIONS.get(r, '')}" for r, t in catalog.CLAUSES.items()}, **catalog.CONTROLS}
_ENTRY_WORDS = {r: _words(t) for r, t in _ENTRIES.items()}
_DF = Counter(w for ws in _ENTRY_WORDS.values() for w in ws)


def candidates(text: str) -> list[str]:
    """Clauses and controls whose words appear in the document, rarest words weighing most (cheap, explainable pre-filter)."""
    words = _words(text)
    scores = {r: sum(math.log(len(_ENTRY_WORDS) / _DF[w]) for w in ws & words) for r, ws in _ENTRY_WORDS.items()}
    return [r for r, s in sorted(scores.items(), key=lambda x: -x[1]) if s > 0][:CANDIDATES]


def _date_in_quote(iso: str, quote: str) -> bool:
    """The quoted sentence must contain the date itself (day and year, and the month as a number or a name)."""
    try:
        d = date.fromisoformat(iso)
    except ValueError:
        return False
    q = quote.lower()
    month = d.strftime("%B").lower()
    has_day = re.search(rf"\b0?{d.day}\b", q) is not None
    has_month = month in q or month[:3] in q or re.search(rf"\b0?{d.month}\b", q) is not None
    return has_day and has_month and str(d.year) in q


async def analyze(ai: AiClient, payload: dict, meta: RunMeta) -> dict:
    p = EvidencePayload.model_validate(payload)
    if p.file.mime not in FILE_TYPES:
        raise ValueError(f"{p.file.mime} files are not analysed (PDF and images only)")
    extracted = await extract(ai, p.file, meta)
    text = extracted["text"]
    if len(text) < MIN_TEXT:
        return {**extracted, "summary": None, "document_type": None, "suggested": [], "expiry": None, "run_id": None,
                "note": "No readable text was found in this file."}
    shortlist = candidates(f"{p.evidence.title}\n{p.evidence.description or ''}\n{text}")
    listing = "\n".join(f"- {r} {catalog.title(r)}" for r in shortlist) or "- (no candidate)"
    user_input = (f"<candidates>\n{listing}\n</candidates>\n\n"
                  f'<evidence title="{p.evidence.title}" file="{p.file.name}">\n{text}\n</evidence>')

    def check(a: Analysis) -> list[str]:
        errors = [f'"{s.ref}" is not in the candidates list' for s in a.suggested if catalog.resolve(s.ref) not in shortlist]
        if len(a.suggested) > 5:
            errors.append("suggest at most 5 controls or clauses")
        if a.expiry:
            if not quote_in(text, a.expiry.quote):
                errors.append(f'the expiry quote "{a.expiry.quote[:80]}" does not appear word for word in the evidence')
            elif not _date_in_quote(a.expiry.date, a.expiry.quote):
                errors.append(f'the expiry date {a.expiry.date} is not the date written in the quoted sentence (or not YYYY-MM-DD)')
        return errors

    try:
        value, run_id, _ = await ai.structured("evidence_analyze", EVIDENCE_ANALYSIS, user_input, Analysis, meta, check)
    except AiRejected as e:
        # Keep the summary; drop the proposals that could not be verified.
        if e.partial is None:
            raise
        value, run_id = e.partial, e.run_id
        value.suggested = [s for s in value.suggested if catalog.resolve(s.ref) in shortlist][:5]
        if value.expiry and not (quote_in(text, value.expiry.quote) and _date_in_quote(value.expiry.date, value.expiry.quote)):
            value.expiry = None

    suggested = []
    for i, s in enumerate(value.suggested[:5]):
        ref = catalog.resolve(s.ref)
        # Confidence computed in code: the model's first choice or a top keyword match, from a clean reading -> "likely".
        likely = (i == 0 or shortlist.index(ref) < 3) and extracted["second_readings"] == 0
        suggested.append({"ref": ref, "title": catalog.title(ref), "reason": s.reason, "confidence": "likely" if likely else "possible"})
    return {
        **extracted,
        "summary": value.summary.strip(),
        "document_type": value.document_type.strip(),
        "suggested": suggested,
        "expiry": value.expiry.model_dump() if value.expiry else None,
        "run_id": run_id,
    }
