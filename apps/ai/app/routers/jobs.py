"""Long AI tasks: submit with an idempotency key (202 + job id), then read the status and result."""

import asyncio
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.jobs import connect, enqueue
from app.models import AiJob
from app.review import DOCUMENT_REVIEW, ReviewPayload
from app.security import require_service_token

router = APIRouter(prefix="/v1/jobs", tags=["jobs"], dependencies=[Depends(require_service_token)])

# Payload model and prompt of each kind: the prompt version is part of the key, so a new prompt means a new job.
KINDS = {"review": (ReviewPayload, DOCUMENT_REVIEW)}


class JobRequest(BaseModel):
    kind: Literal["review"]
    idempotency_key: str = Field(min_length=8, max_length=200)
    project_id: uuid.UUID
    user_id: uuid.UUID
    payload: dict


def _view(job: AiJob) -> dict:
    return {"job_id": str(job.id), "status": job.status, "attempts": job.attempts, "result": job.result, "error": job.error}


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def submit(body: JobRequest, request: Request) -> dict:
    schema, prompt = KINDS[body.kind]
    try:
        schema.model_validate(body.payload)
    except ValidationError as e:
        raise HTTPException(422, e.errors(include_url=False, include_context=False)) from e
    key = f"{body.idempotency_key}:{prompt.ref}"
    async with request.app.state.sessions() as s:
        new_id = await s.scalar(
            insert(AiJob).values(id=uuid.uuid4(), idempotency_key=key, kind=body.kind, project_id=body.project_id,
                                 user_id=body.user_id, payload=body.payload, status="queued", attempts=0)
            .on_conflict_do_nothing(index_elements=["idempotency_key"]).returning(AiJob.id)
        )
        await s.commit()
        job = await s.scalar(select(AiJob).where(AiJob.idempotency_key == key))
    if new_id is not None:
        pool = request.app.state.arq or await connect()
        request.app.state.arq = pool
        if pool is not None:
            try:
                await asyncio.wait_for(enqueue(pool, job), timeout=2)
            except Exception:  # noqa: BLE001 - the job stays queued; the sweeper sends it when Redis is back
                request.app.state.arq = None
    return _view(job)


@router.get("/{job_id}")
async def get(job_id: uuid.UUID, project_id: uuid.UUID, request: Request) -> dict:
    async with request.app.state.sessions() as s:
        job = await s.scalar(select(AiJob).where(AiJob.id == job_id, AiJob.project_id == project_id))
    if job is None:
        raise HTTPException(404, "Job not found")
    return _view(job)
