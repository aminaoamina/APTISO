"""Wizard suggestions and paragraph improvement. Permissions were checked by the backend; this only does the AI work."""

import json
import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.llm.client import AiUnavailable, RunMeta
from app.models import AiRun
from app.prompts.assist import IMPROVE_INSTRUCTIONS, IMPROVE_PARAGRAPH, NEXT_ACTIONS, WEEKLY_DIGEST, WIZARD_SUGGEST
from app.security import require_service_token
from app.validation import quote_in, unsupported_names

router = APIRouter(prefix="/v1", tags=["assist"], dependencies=[Depends(require_service_token)])

_PLACEHOLDER = re.compile(r"\[[^\]]{2,40}\]|\bTBD\b|\bXXX\b|<[a-z ]{3,30}>", re.IGNORECASE)
# Facts that must not appear out of nowhere in a rewrite: numbers (24 hours, 30 days, 2026) and control/clause IDs.
_FACT = re.compile(r"\bA\.\d+(?:\.\d+)*\b|\b\d+(?:[.,:]\d+)*\b")
# Clause and control numbers ("A.8.16", "clause 4.3") that a next-action reason must not bring in.
_CLAUSE_OR_CONTROL = re.compile(r"\bA\.\d+\.\d+\b|\b(?:clause|control)\s+\d+(?:\.\d+)*", re.IGNORECASE)


class ContextItem(BaseModel):
    id: str = Field(max_length=60)
    label: str = Field(max_length=200)
    text: str = Field(max_length=4000)


class Question(BaseModel):
    key: str = Field(max_length=80)
    label: str = Field(max_length=200)
    help_text: str | None = Field(default=None, max_length=1000)
    long: bool


class SuggestRequest(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID
    document: str = Field(max_length=250)
    question: Question
    items: list[ContextItem] = Field(max_length=80)


class Support(BaseModel):
    data_id: str
    quote: str


class Suggestion(BaseModel):
    answer: str
    support: list[Support]
    missing: list[str]


@router.post("/wizard/suggest")
async def suggest(body: SuggestRequest, request: Request) -> dict:
    """✨ Suggest: an answer for one wizard question, based only on the context items sent by the backend."""
    max_chars = 2000 if body.question.long else 300
    texts = {i.id: i.text for i in body.items}
    data = "\n".join(f'<data id="{i.id}" name="{i.label}">\n{i.text}\n</data>' for i in body.items) or "<data>No information about the organization yet.</data>"
    question = (
        f"Document: {body.document}\nQuestion: {body.question.label}\n"
        + (f"Help: {body.question.help_text}\n" if body.question.help_text else "")
        + f"Field type: {'long text (a few sentences or a list)' if body.question.long else 'short text (a few words)'}, at most {max_chars} characters."
    )

    def check(s: Suggestion) -> list[str]:
        errors = []
        for sup in s.support:
            if sup.data_id not in texts:
                errors.append(f'support refers to "{sup.data_id}", which is not one of the data ids')
            elif not quote_in(texts[sup.data_id], sup.quote):
                errors.append(f'the quote "{sup.quote}" does not appear word for word in data "{sup.data_id}"')
        if not s.answer.strip() and not s.missing:
            errors.append("the answer is empty but missing does not say what information is needed")
        if s.answer.strip() and not s.support:
            errors.append("support must quote the data the answer comes from")
        if names := unsupported_names(s.answer, "\n".join(texts.values())):
            errors.append(f"the answer names {', '.join(map(repr, names))}, which the data does not mention: remove them, or leave the answer empty and report the information as missing")
        if len(s.answer) > max_chars:
            errors.append(f"the answer is {len(s.answer)} characters, the field allows {max_chars}")
        if m := _PLACEHOLDER.search(s.answer):
            errors.append(f'the answer contains the placeholder "{m.group(0)}": write the real value or report it as missing')
        return errors

    value, run_id, model = await request.app.state.ai.structured(
        "wizard_suggest", WIZARD_SUGGEST, f"{data}\n\n{question}", Suggestion,
        RunMeta(str(body.project_id), str(body.user_id), "wizard_question", body.question.key), check,
    )
    return {
        "answer": value.answer.strip(),
        "missing": value.missing,
        "support": [s.model_dump() for s in value.support],
        "run_id": run_id,
        "model": model,
    }


class ImproveRequest(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID
    document_id: uuid.UUID
    text: str = Field(min_length=1, max_length=4000)
    instruction: str = Field(max_length=300)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/improve")
async def improve(body: ImproveRequest, request: Request) -> StreamingResponse:
    """Improve paragraph, streamed as SSE: `delta` pieces, then `done` (run_id, added_facts) or `error`."""
    instruction = IMPROVE_INSTRUCTIONS.get(body.instruction, body.instruction)
    messages = [{"role": "user", "content": f"Instruction: {instruction}\n\n<document>\n{body.text}\n</document>"}]
    meta = RunMeta(str(body.project_id), str(body.user_id), "document", str(body.document_id))

    async def events():
        try:
            async for event, data in request.app.state.ai.stream("paragraph_improve", IMPROVE_PARAGRAPH, messages, meta):
                if event == "delta":
                    yield _sse("delta", data)
                else:
                    original = {f.lower() for f in _FACT.findall(body.text)}
                    added = list(dict.fromkeys(f for f in _FACT.findall(data["text"]) if f.lower() not in original))
                    yield _sse("done", {"run_id": data["run_id"], "model": data["model"], "added_facts": added})
        except AiUnavailable:
            yield _sse("error", {"code": "ai_unavailable", "message": "No model is available right now"})

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


class Outcome(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID
    outcome: Literal["accepted", "dismissed"]


@router.post("/runs/{run_id}/outcome")
async def outcome(run_id: uuid.UUID, body: Outcome, request: Request) -> dict:
    """Copy of the human decision on a proposal, for statistics. Only the person the run was made for, in that project."""
    async with request.app.state.sessions() as session:
        run = await session.scalar(select(AiRun).where(AiRun.id == run_id))
        if not run or run.project_id != body.project_id or run.user_id != body.user_id or run.status != "succeeded":
            raise HTTPException(404, "AI run not found")
        run.outcome = body.outcome
        await session.commit()
        return {"capability": run.capability, "subject_type": run.subject_type, "subject_id": run.subject_id}


class ActionItem(BaseModel):
    id: str = Field(max_length=80)
    text: str = Field(max_length=600)


class NextActionsRequest(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID
    user: str = Field(max_length=600)
    items: list[ActionItem] = Field(min_length=1, max_length=40)


class Action(BaseModel):
    id: str
    why: str


class Actions(BaseModel):
    actions: list[Action]


@router.post("/next-actions")
async def next_actions(body: NextActionsRequest, request: Request) -> dict:
    """Ranks and phrases the person's items (computed by the backend); every id must be one of them."""
    ids = {i.id for i in body.items}
    items = "\n".join(f'<item id="{i.id}">{i.text}</item>' for i in body.items)

    def check(a: Actions) -> list[str]:
        errors = [f'"{x.id}" is not one of the item ids' for x in a.actions if x.id not in ids]
        if len(a.actions) > 5:
            errors.append("give at most 5 actions")
        # A reason must not bring in clauses or controls the item does not mention.
        errors += [f'the reason for "{x.id}" mentions {m.group(0)}: remove clause and control numbers' for x in a.actions if (m := _CLAUSE_OR_CONTROL.search(x.why))]
        return errors

    value, run_id, _ = await request.app.state.ai.structured(
        "next_actions", NEXT_ACTIONS, f'<data name="person">{body.user}</data>\n{items}', Actions,
        RunMeta(str(body.project_id), str(body.user_id), "next_actions", None), check,
    )
    return {"actions": [a.model_dump() for a in value.actions[:5]], "run_id": run_id}


class DigestProject(BaseModel):
    id: uuid.UUID
    facts: str = Field(max_length=4000)


class DigestRequest(BaseModel):
    user_id: uuid.UUID
    user: str = Field(max_length=300)
    projects: list[DigestProject] = Field(min_length=1, max_length=10)
    items: list[ActionItem] = Field(max_length=40)


class DigestProjectText(BaseModel):
    id: uuid.UUID
    team: str = Field(max_length=600)
    you: str = Field(max_length=600)


class Digest(BaseModel):
    headline: str = Field(max_length=120)
    projects: list[DigestProjectText]
    next_steps: list[Action]
    tip: str = Field(max_length=500)
    encouragement: str = Field(max_length=300)


_NUMBER = re.compile(r"\b\d+\b")


@router.post("/weekly-digest")
async def weekly_digest(body: DigestRequest, request: Request) -> dict:
    """The words of the weekly e-mail; the facts were computed by the backend and every number must come from them."""
    project_ids = {p.id for p in body.projects}
    item_ids = {i.id for i in body.items}
    facts = "\n".join([f'<project id="{p.id}">{p.facts}</project>' for p in body.projects] + [f'<item id="{i.id}">{i.text}</item>' for i in body.items])
    known_numbers = set(_NUMBER.findall(facts))

    def check(d: Digest) -> list[str]:
        errors = [f'"{p.id}" is not one of the project ids' for p in d.projects if p.id not in project_ids]
        errors += [f'"{x.id}" is not one of the item ids' for x in d.next_steps if x.id not in item_ids]
        if len(d.next_steps) > 4:
            errors.append("give at most 4 next steps")
        texts = [d.headline, d.tip, d.encouragement] + [t for p in d.projects for t in (p.team, p.you)] + [x.why for x in d.next_steps]
        for text in texts:
            errors += [f'the number {n} is not in the data: remove it' for n in set(_NUMBER.findall(text)) - known_numbers]
            if m := _CLAUSE_OR_CONTROL.search(text):
                errors.append(f'"{m.group(0)}": remove clause and control numbers')
        return errors

    value, run_id, _ = await request.app.state.ai.structured(
        "weekly_digest", WEEKLY_DIGEST, f'<data name="person">{body.user}</data>\n{facts}', Digest,
        RunMeta(None, str(body.user_id), "weekly_digest", None), check,
    )
    return {**value.model_dump(mode="json"), "run_id": run_id}
