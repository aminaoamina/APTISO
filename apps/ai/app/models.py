import uuid
from datetime import datetime

from pgvector.sqlalchemy import HALFVEC
from sqlalchemy import Computed, DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class AiRun(Base):
    """Every AI operation: who asked about what, which model, prompt and catalog answered, and the validation result."""

    __tablename__ = "ai_runs"
    __table_args__ = (Index("ix_ai_runs_project_capability", "project_id", "capability"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    capability: Mapped[str] = mapped_column(String(50))
    model: Mapped[str | None] = mapped_column(String(120))
    prompt_version: Mapped[str] = mapped_column(String(60))
    catalog_version: Mapped[str] = mapped_column(String(40))
    input_hash: Mapped[str] = mapped_column(String(64))  # sha256 of the exact input sent to the model
    subject_type: Mapped[str | None] = mapped_column(String(40))
    subject_id: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20))  # succeeded | rejected | failed
    validation: Mapped[dict | None] = mapped_column(JSONB)
    output: Mapped[dict | None] = mapped_column(JSONB)
    tokens_in: Mapped[int | None] = mapped_column(Integer)
    tokens_out: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    # Copy of the human decision, for statistics (the authoritative record is in the business database).
    outcome: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AiJob(Base):
    """A long AI task (document review, evidence analysis). This row is the durable record; Redis only carries it to a worker."""

    __tablename__ = "ai_jobs"
    __table_args__ = (Index("ix_ai_jobs_status_updated", "status", "updated_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The same key always returns the same job: submitting twice never creates two reviews.
    idempotency_key: Mapped[str] = mapped_column(String(300), unique=True)
    kind: Mapped[str] = mapped_column(String(30))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued | running | succeeded | failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    payload: Mapped[dict] = mapped_column(JSONB)
    result: Mapped[dict | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)
    # A running job whose lease expired is considered crashed and queued again.
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


EMBED_DIM = 2048  # nvidia/nemotron-3-embed-1b


class KnowledgeChunk(Base):
    """A searchable passage: a copy of part of a business document (or of the ISO catalog), with its embedding.
    Replaced when the document is indexed again, deleted with it."""

    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        Index("ix_knowledge_chunks_source", "project_id", "source_id"),
        Index("ix_knowledge_chunks_tsv", "tsv", postgresql_using="gin"),
        Index("ix_knowledge_chunks_embedding", "embedding", postgresql_using="hnsw", postgresql_ops={"embedding": "halfvec_cosine_ops"}),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))  # None: shared ISO catalog
    source_type: Mapped[str] = mapped_column(String(30))  # document | iso
    source_id: Mapped[str] = mapped_column(String(64))
    version: Mapped[str | None] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(250))
    section: Mapped[str | None] = mapped_column(String(300))
    refs: Mapped[list[str]] = mapped_column(ARRAY(String(20)), default=list)
    # Who may retrieve it: "all" members, or only "editors" (drafts).
    visibility: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64))
    embedding: Mapped[list[float]] = mapped_column(HALFVEC(EMBED_DIM))
    tsv = mapped_column(TSVECTOR, Computed("to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(section, '') || ' ' || content)", persisted=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
