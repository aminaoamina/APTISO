import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
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
