"""Real-use statistics of the AI features, from the ai_runs journal, and the prompt versions in service."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import case, func, select

from app.config import get_settings
from app.evidence import EVIDENCE_ANALYSIS
from app.models import AiRun
from app.prompts.assist import IMPROVE_PARAGRAPH, NEXT_ACTIONS, WEEKLY_DIGEST, WIZARD_SUGGEST
from app.review import DOCUMENT_REVIEW
from app.routers.knowledge import COMPANION_CHAT
from app.security import require_service_token

router = APIRouter(prefix="/v1", tags=["metrics"], dependencies=[Depends(require_service_token)])

PROMPTS = [p.ref for p in (WIZARD_SUGGEST, IMPROVE_PARAGRAPH, COMPANION_CHAT, DOCUMENT_REVIEW, EVIDENCE_ANALYSIS, NEXT_ACTIONS, WEEKLY_DIGEST)]


def _rate(part, whole):
    return round(part / whole, 3) if whole else None


@router.get("/metrics")
async def metrics(request: Request, days: int = Query(30, ge=1, le=365)) -> dict:
    """Per capability: volume, validation (first try, rejected), fallback model use, latency, tokens and human acceptance."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    ok = AiRun.status == "succeeded"
    first_try = case((AiRun.validation["attempts"].astext == "1", 1), else_=0)
    query = (
        select(
            AiRun.capability,
            func.count(),
            func.count().filter(ok),
            func.count().filter(AiRun.status == "rejected"),
            func.count().filter(AiRun.status == "failed"),
            func.coalesce(func.sum(first_try).filter(ok), 0),
            func.count().filter(ok, AiRun.validation.isnot(None)),
            func.count().filter(AiRun.model == get_settings().ai_model_fallback),
            func.avg(AiRun.latency_ms),
            func.percentile_cont(0.95).within_group(AiRun.latency_ms),
            func.coalesce(func.sum(AiRun.tokens_in), 0),
            func.coalesce(func.sum(AiRun.tokens_out), 0),
            func.count().filter(AiRun.outcome == "accepted"),
            func.count().filter(AiRun.outcome == "dismissed"),
        )
        .where(AiRun.created_at >= since, AiRun.capability != "health")
        .group_by(AiRun.capability)
        .order_by(AiRun.capability)
    )
    async with request.app.state.sessions() as s:
        rows = (await s.execute(query)).all()
    capabilities = []
    for cap, runs, succeeded, rejected, failed, first, validated, fallback, avg_ms, p95_ms, t_in, t_out, accepted, dismissed in rows:
        capabilities.append({
            "capability": cap, "runs": runs, "succeeded": succeeded, "rejected": rejected, "failed": failed,
            # Streamed answers (chat, rewrite) have no structured validation: no rate.
            "valid_first_try_rate": _rate(first, validated),
            "rejected_rate": _rate(rejected, runs),
            "fallback_model_rate": _rate(fallback, runs),
            "latency_ms": {"avg": round(avg_ms) if avg_ms else None, "p95": round(p95_ms) if p95_ms else None},
            "tokens": {"in": t_in, "out": t_out},
            "decisions": {"accepted": accepted, "dismissed": dismissed, "acceptance_rate": _rate(accepted, accepted + dismissed)},
        })
    return {"days": days, "prompts": PROMPTS, "capabilities": capabilities}
