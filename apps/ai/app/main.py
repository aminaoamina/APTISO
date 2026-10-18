from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.config import get_settings
from app.db import create_engine, session_factory
from app.routers import health

BODY_METHODS = {"POST", "PUT", "PATCH"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.engine = create_engine(settings.database_url)
    app.state.sessions = session_factory(app.state.engine)
    app.state.redis = Redis.from_url(settings.redis_url, socket_connect_timeout=2)
    yield
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
        if not length.isdigit() or int(length) > get_settings().max_body_bytes:
            return JSONResponse({"detail": "Request body too large"}, status_code=413)
    return await call_next(request)


app.include_router(health.router)
