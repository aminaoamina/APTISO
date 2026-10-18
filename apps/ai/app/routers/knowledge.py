"""RAG index, search and the companion chat. The backend decides who may see what; this service never reads business data."""

import json
import re
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete

from app import knowledge
from app.llm.client import AiUnavailable, RunMeta
from app.models import AiJob, AiRun, KnowledgeChunk
from app.prompts import Prompt
from app.security import require_service_token

router = APIRouter(prefix="/v1", tags=["knowledge"], dependencies=[Depends(require_service_token)])

COMPANION_CHAT = Prompt(
    "companion-chat",
    1,
    """You are the ISO 27001 companion inside APTISO. You help the person asking, in their role, with their organization's ISMS project.
- Answer from the <source> and <fact> items. Cite each statement with the item ids in square brackets, for example [S2] or [F1].
- <fact> items are the current records of the project (Statement of Applicability, risks, documents, evidence): they are the most reliable.
- If the items do not answer the question, say so clearly and say where in APTISO the person can find or add the information. You may explain what ISO/IEC 27001:2022 requires in general, but say that it is general guidance, not a statement about their organization.
- Adapt to the role: for a project lead, status and gaps; for an implementer, what to do next; for an auditor, evidence and conformity.
- Be concise: a short paragraph or a short list.""",
)
# [S2], and also grouped forms such as [S3, S4] or [S1; F2].
_CITATION = re.compile(r"\[([SF]\d{1,2}(?:\s*[,;]\s*[SF]\d{1,2})*)\]")
_ITEM = re.compile(r"[SF]\d{1,2}")


class Section(BaseModel):
    heading: str | None = Field(default=None, max_length=300)
    text: str = Field(max_length=50_000)


class IndexDocument(BaseModel):
    project_id: uuid.UUID
    source_type: Literal["document", "evidence"] = "document"
    version: str | None = Field(default=None, max_length=20)
    title: str = Field(max_length=250)
    visibility: Literal["all", "editors"]
    refs: list[str] = Field(default_factory=list, max_length=100)
    sections: list[Section] = Field(max_length=300)


@router.put("/index/documents/{document_id}")
async def index_document(document_id: str, body: IndexDocument, request: Request) -> dict:
    """Replaces the document's passages (on publish or when its content or visibility changed)."""
    async with request.app.state.sessions() as s:
        count = await knowledge.index_document(s, request.app.state.ai, body.project_id, body.source_type, document_id, body.version, body.title,
                                               body.visibility, body.refs, [x.model_dump() for x in body.sections])
    return {"chunks": count}


@router.delete("/index/documents/{document_id}")
async def delete_document(document_id: str, project_id: uuid.UUID, request: Request) -> dict:
    async with request.app.state.sessions() as s:
        r = await s.execute(delete(KnowledgeChunk).where(KnowledgeChunk.project_id == project_id, KnowledgeChunk.source_id == document_id))
        await s.commit()
    return {"deleted": r.rowcount}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: uuid.UUID, request: Request) -> dict:
    """The project was deleted in APTISO: its indexed passages, jobs (with their copies of document text) and AI runs go too."""
    async with request.app.state.sessions() as s:
        counts = {}
        for name, model in (("chunks", KnowledgeChunk), ("jobs", AiJob), ("runs", AiRun)):
            counts[name] = (await s.execute(delete(model).where(model.project_id == project_id))).rowcount
        await s.commit()
    return {"deleted": counts}


@router.get("/index/projects/{project_id}")
async def project_stats(project_id: uuid.UUID, request: Request) -> dict:
    async with request.app.state.sessions() as s:
        return {"chunks": await knowledge.stats(s, project_id)}


class SearchRequest(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID
    visibilities: list[Literal["all", "editors"]] = Field(min_length=1)
    query: str = Field(min_length=2, max_length=2000)


@router.post("/search")
async def search(body: SearchRequest, request: Request) -> dict:
    async with request.app.state.sessions() as s:
        return await knowledge.search(s, request.app.state.ai, body.project_id, body.user_id, body.visibilities, body.query)


class Chunk(BaseModel):
    id: str
    source_type: str
    source_id: str
    version: str | None = None
    title: str = Field(max_length=250)
    section: str | None = Field(default=None, max_length=300)
    content: str = Field(max_length=6000)


class Fact(BaseModel):
    text: str = Field(max_length=2000)
    source_type: str = Field(max_length=30)
    source_id: str | None = Field(default=None, max_length=64)


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=6000)


class ChatRequest(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID
    question: str = Field(min_length=1, max_length=2000)
    user: str = Field(max_length=4000)  # who is asking: name, role, tasks (from the backend)
    history: list[Turn] = Field(default_factory=list, max_length=6)
    chunks: list[Chunk] = Field(max_length=12)
    facts: list[Fact] = Field(max_length=60)


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(body: ChatRequest, request: Request) -> StreamingResponse:
    """Streams the answer (`delta`), then the citations that point to items actually provided (`citations`), then `done`."""
    items = {f"S{i + 1}": ("source", c) for i, c in enumerate(body.chunks)} | {f"F{i + 1}": ("fact", f) for i, f in enumerate(body.facts)}
    sources = "\n".join(f'<source id="S{i + 1}" title="{c.title}"{f" section={json.dumps(c.section)}" if c.section else ""}>\n{c.content}\n</source>'
                        for i, c in enumerate(body.chunks))
    facts = "\n".join(f'<fact id="F{i + 1}">{f.text}</fact>' for i, f in enumerate(body.facts))
    messages = [
        *[t.model_dump() for t in body.history],
        {"role": "user", "content": f"<data name=\"person\">\n{body.user}\n</data>\n\n{facts or '<fact>No project records match this question.</fact>'}\n\n"
                                    f"{sources or '<source>No document passage matches this question.</source>'}\n\nQuestion: {body.question}"},
    ]
    meta = RunMeta(str(body.project_id), str(body.user_id), "chat", None)

    async def events():
        try:
            async for event, data in request.app.state.ai.stream("companion_chat", COMPANION_CHAT, messages, meta):
                if event == "delta":
                    yield _sse("delta", data)
                    continue
                cited = list(dict.fromkeys(i for group in _CITATION.findall(data["text"]) for i in _ITEM.findall(group)))
                valid = [c for c in cited if c in items]
                yield _sse("citations", [
                    {"id": c, "kind": items[c][0], "source_type": items[c][1].source_type, "source_id": items[c][1].source_id,
                     "title": items[c][1].title if items[c][0] == "source" else items[c][1].text[:160],
                     "section": items[c][1].section if items[c][0] == "source" else None}
                    for c in valid
                ])
                yield _sse("done", {"run_id": data["run_id"], "model": data["model"], "invalid_citations": [c for c in cited if c not in items]})
        except AiUnavailable:
            yield _sse("error", {"code": "ai_unavailable", "message": "No model is available right now"})

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
