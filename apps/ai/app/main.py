from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.config import get_settings
from app.db import create_engine, session_factory
from app.llm.client import AiClient, AiRejected, AiUnavailable
from app.routers import assist, health, jobs, knowledge

BODY_METHODS = {"POST", "PUT", "PATCH"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.engine = create_engine(settings.database_url)
    app.state.sessions = session_factory(app.state.engine)
    app.state.redis = Redis.from_url(settings.redis_url, socket_connect_timeout=2)
    app.state.ai = AiClient(settings, app.state.sessions)
    app.state.arq = None  # job queue pool, connected on first use
    yield
    if app.state.arq is not None:
        await app.state.arq.aclose()
    await app.state.redis.aclose()
    await app.state.engine.dispose()


app = FastAPI(
    title="APTISO AI service",
    version="0.1.0",
    description="Internal AI service of APTISO. Called only by the NestJS backend (X-Service-Token).",
    lifespan=lifespan,
)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Bodies must declare their size, within the limit (the backend always sends Content-Length)."""
    if request.method in BODY_METHODS:
        length = request.headers.get("content-length")
        if length is None:
            return JSONResponse({"detail": "Content-Length required"}, status_code=411)
        settings = get_settings()
        limit = settings.max_job_body_bytes if request.url.path == "/v1/jobs" else settings.max_body_bytes
        if not length.isdigit() or int(length) > limit:
            return JSONResponse({"detail": "Request body too large"}, status_code=413)
    return await call_next(request)


@app.exception_handler(AiUnavailable)
async def ai_unavailable(_: Request, e: AiUnavailable):
    return JSONResponse({"detail": "No model is available right now", "code": "ai_unavailable"}, status_code=503)


@app.exception_handler(AiRejected)
async def ai_rejected(_: Request, e: AiRejected):
    # The answer failed validation twice: reported, never returned as valid.
    return JSONResponse(
        {"detail": "The AI answer did not pass validation", "code": "ai_rejected", "errors": e.errors, "run_id": e.run_id},
        status_code=422,
    )


app.include_router(health.router)
app.include_router(assist.router)
app.include_router(jobs.router)
app.include_router(knowledge.router)
