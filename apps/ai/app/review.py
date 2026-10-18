"""Document review: does the document cover what its clauses and controls require, does it match the SoA,
and is it precise enough to be audited? The model proposes findings; the code keeps only verifiable ones."""

import re
from typing import Literal

from pydantic import BaseModel, Field

from app import catalog
from app.llm.client import AiClient, AiRejected, RunMeta
from app.prompts import Prompt
from app.validation import quote_in

MAX_TEXT = 40_000
MAX_FINDINGS = 25

DOCUMENT_REVIEW = Prompt(
    "document-review",
    1,
    """You review a document of an ISO/IEC 27001:2022 management system before it is approved, the way a certification auditor would read it.
Report only real problems, of three types:
- "missing": something the listed clause or control requires that the document does not address (for example how restores of backups are tested).
- "contradiction": the document says something different from the organization's Statement of Applicability (SoA) entry for that control, or contradicts itself.
- "vague": wording an auditor could not verify, such as "regularly", "where possible" or "as appropriate" without a frequency, owner or criterion.
Rules:
- "ref" is the clause or control the problem is about, chosen only from the <requirements> list.
- For "contradiction" and "vague", "quote" is the exact sentence or phrase from the document, copied word for word. For "missing", "quote" is null.
- "explanation" says why an auditor would raise it; "suggestion" says concretely what to write.
- "severity": high = an auditor would raise a nonconformity; medium = likely an observation; low = wording improvement.
- No findings about formatting, style or things the document does well. If the document is fine, return an empty list.""",
)

# Phrases auditors cannot verify; the model decides whether each occurrence is a real problem.
_VAGUE = re.compile(r"\b(regularly|periodically|where possible|if possible|as appropriate|as needed|when necessary|sometimes|from time to time|adequate|sufficient|timely|promptly|etc\.?)\b", re.IGNORECASE)


class SoaEntry(BaseModel):
    applicable: bool | None = None
    justification: str | None = Field(default=None, max_length=3000)
    method: str | None = Field(default=None, max_length=3000)
    status: str | None = Field(default=None, max_length=40)


class Covered(BaseModel):
    ref: str = Field(max_length=20)
    soa: SoaEntry | None = None


class ReviewDocument(BaseModel):
    id: str = Field(max_length=60)
    title: str = Field(max_length=250)
    text: str = Field(min_length=1, max_length=200_000)


class ReviewPayload(BaseModel):
    document: ReviewDocument
    covers: list[Covered] = Field(min_length=1, max_length=60)


class Finding(BaseModel):
    type: Literal["missing", "contradiction", "vague"]
    ref: str
    quote: str | None
    explanation: str
    suggestion: str
    severity: Literal["low", "medium", "high"]


class Findings(BaseModel):
    findings: list[Finding]


def _finding_errors(f: Finding, covered: set[str], text: str) -> list[str]:
    errors = []
    ref = catalog.resolve(f.ref)
    if ref is None:
        errors.append(f'"{f.ref}" is not an ISO/IEC 27001:2022 clause or control')
    elif ref not in covered:
        errors.append(f'"{f.ref}" is not in the requirements list of this document')
    if f.type in ("contradiction", "vague") and not f.quote:
        errors.append(f"a {f.type} finding needs the exact quote from the document")
    if f.quote and not quote_in(text, f.quote):
        errors.append(f'the quote "{f.quote[:80]}" does not appear word for word in the document')
    return errors


def _requirement(ref: str, soa: SoaEntry | None) -> str:
    """One line of the <requirements> list: what the clause asks, or the control and its SoA entry."""
    line = f"- {ref} {catalog.title(ref)}"
    if ref in catalog.CLAUSE_QUESTIONS:
        line += f": {catalog.CLAUSE_QUESTIONS[ref]}"
    if soa:
        decision = {True: "applicable", False: "not applicable", None: "not decided"}[soa.applicable]
        details = [
            f"implementation method: {soa.method}" if soa.method else "",
            f"status: {soa.status}" if soa.status else "",
            f"justification: {soa.justification}" if soa.justification else "",
        ]
        line += "\n  SoA: " + "; ".join([decision, *filter(None, details)])
    return line


async def review(ai: AiClient, payload: dict, meta: RunMeta) -> dict:
    p = ReviewPayload.model_validate(payload)
    text = p.document.text[:MAX_TEXT]
    covered: dict[str, SoaEntry | None] = {}
    for c in p.covers:
        if ref := catalog.resolve(c.ref):
            covered[ref] = c.soa

    lines = [_requirement(ref, soa) for ref, soa in covered.items()]
    vague = sorted({m.group(0).lower() for m in _VAGUE.finditer(text)})
    user_input = (
        f"<requirements>\n{chr(10).join(lines)}\n</requirements>\n\n"
        f'<document title="{p.document.title}">\n{text}\n</document>'
        + ("\n\n[document truncated for the review]" if len(p.document.text) > MAX_TEXT else "")
        + (f"\n\nWords found that are often too vague to audit (check each occurrence): {', '.join(vague)}" if vague else "")
    )

    def check(v: Findings) -> list[str]:
        errors = [f"finding {i + 1}: {e}" for i, f in enumerate(v.findings) for e in _finding_errors(f, set(covered), text)]
        if len(v.findings) > MAX_FINDINGS:
            errors.append(f"report at most {MAX_FINDINGS} findings, the most important first")
        return errors

    try:
        value, run_id, model = await ai.structured("document_review", DOCUMENT_REVIEW, user_input, Findings, meta, check)
        kept, dropped = value.findings, []
    except AiRejected as e:
        # Keep the findings that pass every check; record the others, never show them.
        if e.partial is None:
            raise
        run_id, model = e.run_id, ""
        checked = [(f, _finding_errors(f, set(covered), text)) for f in e.partial.findings]
        kept = [f for f, errors in checked if not errors]
        dropped = [{"finding": f.model_dump(), "errors": errors} for f, errors in checked if errors]

    findings = [{**f.model_dump(), "ref": catalog.resolve(f.ref)} for f in kept[:MAX_FINDINGS]]
    return {"findings": findings, "dropped": dropped, "run_id": run_id, "model": model, "prompt": DOCUMENT_REVIEW.ref, "catalog": catalog.VERSION}
