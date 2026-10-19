"""Background jobs (arq on Redis). The ai_jobs row is the durable record: Redis only carries the job to a worker.

Run the worker with:  arq app.jobs.WorkerSettings
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from arq import cron
from arq.connections import ArqRedis, RedisSettings, create_pool
from sqlalchemy import select, update

from app.config import get_settings
from app.db import create_engine, session_factory
from app.llm.client import AiClient, RunMeta
from app.models import AiJob
from app.evidence import analyze
from app.review import review

log = logging.getLogger("ai.jobs")

MAX_ATTEMPTS = 3
LEASE = timedelta(minutes=5)
REQUEUE_AFTER = timedelta(minutes=1)
HANDLERS = {"review": review, "evidence": analyze}
# Copies of business files are not kept once the job is over.
FILE_FIELDS = {"evidence": ("file", "data")}


def redis_settings(*, worker: bool) -> RedisSettings:
    """The worker keeps reconnecting when Redis restarts; the API gives up fast (the job stays queued)."""
    s = RedisSettings.from_dsn(get_settings().redis_url)
    s.conn_timeout = 2
    s.conn_retries, s.conn_retry_delay = (30, 2) if worker else (0, 0)
    return s


async def enqueue(pool: ArqRedis, job: AiJob) -> None:
    # One arq id per attempt: arq ignores a second enqueue of the same id, so the sweeper never doubles a job.
    await pool.enqueue_job("run_job", str(job.id), _job_id=f"{job.id}:{job.attempts}")


async def run_job(ctx: dict, job_id: str) -> None:
    sessions = ctx["sessions"]
    now = datetime.now(timezone.utc)
    async with sessions() as s:
        # Claim the job atomically: only a queued job can start, and only once.
        job = await s.scalar(
            update(AiJob).where(AiJob.id == uuid.UUID(job_id), AiJob.status == "queued")
            .values(status="running", attempts=AiJob.attempts + 1, lease_until=now + LEASE).returning(AiJob)
        )
        await s.commit()
    if job is None:
        return
    subject = job.payload.get("document") or job.payload.get("evidence") or {}
    meta = RunMeta(str(job.project_id), str(job.user_id), job.kind, subject.get("id"))
    try:
        result = await HANDLERS[job.kind](ctx["ai"], job.payload, meta)
        values = {"status": "succeeded", "result": result, "error": None, "lease_until": None}
    except Exception as e:  # noqa: BLE001 - every failure is recorded on the job
        log.warning("job %s (%s) attempt %s failed: %s", job.id, job.kind, job.attempts, e)
        final = job.attempts >= MAX_ATTEMPTS
        values = {"status": "failed" if final else "queued", "error": f"{type(e).__name__}: {e}"[:2000], "lease_until": None}
    if values["status"] in ("succeeded", "failed") and job.kind in FILE_FIELDS:
        section, field = FILE_FIELDS[job.kind]
        values["payload"] = {**job.payload, section: {k: v for k, v in job.payload[section].items() if k != field}}
    # The result is saved before the job is reported done.
    async with sessions() as s:
        await s.execute(update(AiJob).where(AiJob.id == job.id).values(**values))
        await s.commit()


async def sweep(ctx: dict) -> None:
    """Every minute: crashed jobs (expired lease) are queued again; queued jobs that never reached a worker are re-sent."""
    now = datetime.now(timezone.utc)
    async with ctx["sessions"]() as s:
        await s.execute(
            update(AiJob).where(AiJob.status == "running", AiJob.lease_until < now)
            .values(status="queued", lease_until=None, error="The worker stopped during the job")
        )
        await s.execute(update(AiJob).where(AiJob.status == "queued", AiJob.attempts >= MAX_ATTEMPTS).values(status="failed"))
        await s.commit()
        stuck = (await s.scalars(select(AiJob).where(AiJob.status == "queued", AiJob.updated_at < now - REQUEUE_AFTER))).all()
    for job in stuck:
        await enqueue(ctx["redis"], job)
    if stuck:
        log.info("sweeper re-sent %s job(s)", len(stuck))


async def startup(ctx: dict) -> None:
    settings = get_settings()
    ctx["engine"] = create_engine(settings.database_url)
    ctx["sessions"] = session_factory(ctx["engine"])
    ctx["ai"] = AiClient(settings, ctx["sessions"])


async def shutdown(ctx: dict) -> None:
    await ctx["engine"].dispose()


async def connect() -> ArqRedis | None:
    """Pool for the API to enqueue jobs; None when Redis is down (the job stays queued for the sweeper)."""
    try:
        return await create_pool(redis_settings(worker=False))
    except Exception as e:  # noqa: BLE001
        log.warning("Redis unavailable for jobs: %s", e)
        return None


class WorkerSettings:
    functions = [run_job]
    cron_jobs = [cron(sweep, second=0, run_at_startup=True)]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = redis_settings(worker=True)
    max_jobs = 2  # concurrency limit towards the provider
    job_timeout = 300
    keep_result = 60
