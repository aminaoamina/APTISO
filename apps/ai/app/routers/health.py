import asyncio
import time

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import text

from app import catalog
from app.llm.client import AiUnavailable, RunMeta
from app.prompts import HEALTH
from app.security import require_service_token

router = APIRouter(prefix="/v1/health", tags=["health"])

CHECK_TIMEOUT_S = 2


@router.get("/live")
async def live() -> dict:
    """The process is up. No dependencies and no details: safe for any probe."""
    return {"status": "ok"}


@router.get("/ready", dependencies=[Depends(require_service_token)])
async def ready(request: Request, response: Response, probe: bool = False) -> dict:
    """Dependencies the service needs; 503 when one is down. `probe=true` also makes one real model call."""
    ai = request.app.state.ai
    checks = {"database": await _database(request), "redis": await _redis(request), "models": {"ok": ai.enabled, "configured": ai.models}}
    if probe:
        checks["provider"] = await _provider(ai)
    healthy = all(c["ok"] for c in checks.values())
    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if healthy else "degraded", "catalog": catalog.VERSION, "checks": checks}


async def _provider(ai) -> dict:
    started = time.monotonic()
    try:
        _, run_id, model = await ai.text("health", HEALTH, [{"role": "user", "content": "ping"}], RunMeta(subject_type="health"))
        return {"ok": True, "model": model, "latency_ms": int((time.monotonic() - started) * 1000), "run_id": run_id}
    except AiUnavailable as e:
        return {"ok": False, "error": str(e)}


async def _database(request: Request) -> dict:
    try:
        async with request.app.state.engine.connect() as conn:
            version = await asyncio.wait_for(
                conn.scalar(text("SELECT extversion FROM pg_extension WHERE extname = 'vector'")), CHECK_TIMEOUT_S
            )
        return {"ok": version is not None, "pgvector": version}
    except Exception as e:  # noqa: BLE001 - reported, not raised
        return {"ok": False, "error": type(e).__name__}


async def _redis(request: Request) -> dict:
    try:
        await asyncio.wait_for(request.app.state.redis.ping(), CHECK_TIMEOUT_S)
        return {"ok": True}
    except Exception as e:  # noqa: BLE001 - reported, not raised
        return {"ok": False, "error": type(e).__name__}
