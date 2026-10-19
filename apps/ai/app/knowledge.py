"""The RAG index: passages of the project's documents and of the ISO catalog, searched by meaning and by exact words.

Permissions are decided by the backend: search is always filtered by the project and the visibilities it sends.
"""

import hashlib
import re
import uuid

from sqlalchemy import delete, func, literal_column, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import catalog
from app.llm.client import AiClient, RunMeta
from app.models import KnowledgeChunk

CHUNK_CHARS = 1500
TOP_K = 8
CANDIDATES = 20
RRF_K = 60
_REF = re.compile(r"\b(?:A\s?\.?\s?)?\d{1,2}(?:\.\d{1,2}){1,2}\b", re.IGNORECASE)


def _hash(*parts: str) -> str:
    return hashlib.sha256("\x1f".join(parts).encode()).hexdigest()


def find_refs(value: str) -> list[str]:
    """Clause and control IDs written in a text (A.8.13, 5.15, 9.2)."""
    return list(dict.fromkeys(r for m in _REF.finditer(value) if (r := catalog.resolve(m.group(0)))))


def chunk_sections(sections: list[dict]) -> list[tuple[str | None, str]]:
    """(heading, text) pieces of at most ~CHUNK_CHARS, cut between paragraphs."""
    out: list[tuple[str | None, str]] = []
    for sec in sections:
        heading, buf = sec.get("heading"), ""
        for para in [p.strip() for p in sec["text"].split("\n") if p.strip()]:
            if buf and len(buf) + len(para) > CHUNK_CHARS:
                out.append((heading, buf))
                buf = ""
            buf = f"{buf}\n{para}" if buf else para[: CHUNK_CHARS * 2]
        if buf:
            out.append((heading, buf))
    return out


async def index_document(session: AsyncSession, ai: AiClient, project_id: uuid.UUID, source_type: str, document_id: str, version: str | None,
                         title: str, visibility: str, refs: list[str], sections: list[dict]) -> int:
    """Replaces every chunk of the document (or evidence); unchanged chunks keep their embedding (no new model call)."""
    pieces = chunk_sections(sections)
    old = {c.content_hash: c.embedding for c in (await session.scalars(
        select(KnowledgeChunk).where(KnowledgeChunk.project_id == project_id, KnowledgeChunk.source_id == document_id))).all()}
    hashes = [_hash(title, h or "", t) for h, t in pieces]
    missing = [i for i, h in enumerate(hashes) if h not in old]
    new_vectors = await ai.embed([f"{title}\n{pieces[i][0] or ''}\n{pieces[i][1]}" for i in missing], "passage",
                                 RunMeta(str(project_id), None, source_type, document_id)) if missing else []
    vectors = dict(zip(missing, new_vectors))
    resolved = [r for r in (catalog.resolve(x) for x in refs) if r]
    await session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.project_id == project_id, KnowledgeChunk.source_id == document_id))
    for i, (heading, body) in enumerate(pieces):
        session.add(KnowledgeChunk(
            project_id=project_id, source_type=source_type, source_id=document_id, version=version, title=title, section=heading,
            refs=list(dict.fromkeys(resolved + find_refs(body))), visibility=visibility, content=body, content_hash=hashes[i],
            embedding=vectors[i] if i in vectors else old[hashes[i]],
        ))
    await session.commit()
    return len(pieces)


def _guide_text(ref: str, head: str) -> str:
    """The searchable text of a clause or control: its audit question or title, then the APTISO guide if there is one."""
    g = catalog.GUIDES.get(ref)
    if not g:
        return head
    def bullets(items: list[str]) -> str:
        return "\n".join(f"- {i}" for i in items)

    return (f"{head}\nAPTISO implementation guide (general guidance, not the text of the standard).\n"
            f"Objective: {g['objective']}\nWhat an auditor checks:\n{bullets(g['auditor_expects'])}\n"
            f"Examples of evidence:\n{bullets(g['evidence'])}\nCommon pitfalls:\n{bullets(g['pitfalls'])}")


async def ensure_catalog(session: AsyncSession, ai: AiClient) -> None:
    """The ISO catalog (titles, audit questions) and APTISO's implementation guides as shared knowledge,
    embedded once per knowledge version (catalog + guides)."""
    if await session.scalar(select(func.count()).select_from(KnowledgeChunk).where(KnowledgeChunk.source_type == "iso", KnowledgeChunk.version == catalog.KNOWLEDGE_VERSION)):
        return
    entries = [(r, f"Clause {r} {t}", _guide_text(r, catalog.CLAUSE_QUESTIONS.get(r, t))) for r, t in catalog.CLAUSES.items()]
    entries += [(r, f"{r} {t}", _guide_text(r, f"Annex A control {r}: {t}")) for r, t in catalog.CONTROLS.items()]
    vectors = await ai.embed([f"{title}\n{body}" for _, title, body in entries], "passage", RunMeta(subject_type="iso_catalog"))
    await session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.source_type == "iso"))
    for (ref, title, body), vec in zip(entries, vectors):
        session.add(KnowledgeChunk(project_id=None, source_type="iso", source_id=ref, version=catalog.KNOWLEDGE_VERSION, title=title, section=None,
                                   refs=[ref], visibility="all", content=body, content_hash=_hash(title, body), embedding=vec))
    await session.commit()


async def search(session: AsyncSession, ai: AiClient, project_id: uuid.UUID, user_id: uuid.UUID, visibilities: list[str], query: str) -> dict:
    """Hybrid search: by meaning (vectors), by words (full text) and by the IDs named in the question, merged by reciprocal rank fusion.
    Only this project's chunks the user may see, plus the shared ISO catalog."""
    await ensure_catalog(session, ai)
    allowed = (or_(KnowledgeChunk.project_id == project_id, KnowledgeChunk.project_id.is_(None)), KnowledgeChunk.visibility.in_(visibilities))
    [vector] = await ai.embed([query], "query", RunMeta(str(project_id), str(user_id), "chat"))
    query_refs = find_refs(query)

    by_meaning = (await session.scalars(
        select(KnowledgeChunk.id).where(*allowed).order_by(KnowledgeChunk.embedding.cosine_distance(vector)).limit(CANDIDATES))).all()
    tsquery = func.websearch_to_tsquery(literal_column("'simple'"), query)
    by_words = (await session.scalars(
        select(KnowledgeChunk.id).where(*allowed, KnowledgeChunk.tsv.op("@@")(tsquery))
        .order_by(func.ts_rank(KnowledgeChunk.tsv, tsquery).desc()).limit(CANDIDATES))).all()
    by_ref = (await session.scalars(
        select(KnowledgeChunk.id).where(*allowed, KnowledgeChunk.refs.overlap(query_refs)).order_by(KnowledgeChunk.source_type).limit(CANDIDATES))).all() if query_refs else []

    scores: dict[uuid.UUID, float] = {}
    for ranking in (by_meaning, by_words, by_ref):
        for rank, cid in enumerate(ranking):
            scores[cid] = scores.get(cid, 0) + 1 / (RRF_K + rank + 1)
    best = sorted(scores, key=scores.get, reverse=True)[:TOP_K]
    rows = {c.id: c for c in (await session.scalars(select(KnowledgeChunk).where(KnowledgeChunk.id.in_(best)))).all()}
    chunks = [rows[i] for i in best if i in rows]
    refs = list(dict.fromkeys(query_refs + [r for c in chunks for r in c.refs]))
    return {
        "chunks": [{"id": str(c.id), "source_type": c.source_type, "source_id": c.source_id, "version": c.version, "title": c.title,
                    "section": c.section, "refs": c.refs, "content": c.content} for c in chunks],
        "refs": refs[:12],
    }


async def stats(session: AsyncSession, project_id: uuid.UUID) -> int:
    return await session.scalar(select(func.count()).select_from(KnowledgeChunk).where(KnowledgeChunk.project_id == project_id)) or 0

