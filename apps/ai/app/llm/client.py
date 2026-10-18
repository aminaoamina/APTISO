"""The only way the AI service talks to a model (NVIDIA Build, OpenAI-compatible API).

Per capability: models with fallback, timeout, transient-only retries with
backoff, JSON mode and reasoning switch. Every call is recorded as an AI run.
"""

import asyncio
import hashlib
import json
import logging
import random
import time
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass, field

import openai
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker

from app import catalog
from app.config import Settings
from app.llm.capabilities import CAPABILITIES, Capability, ModelRole
from app.llm.json_repair import parse_model_json
from app.models import AiRun
from app.prompts import BASE_RULES, Prompt

log = logging.getLogger("ai.llm")


class AiUnavailable(Exception):
    """No model could answer (provider down, timeouts, bad key)."""


class AiRejected(Exception):
    """The answer failed validation twice: nothing is returned as if it were valid."""

    def __init__(self, errors: list[str], run_id: str, partial: BaseModel | None = None):
        super().__init__("; ".join(errors[:3]))
        # The last answer that matched the schema, so callers can keep its valid parts.
        self.errors, self.run_id, self.partial = errors, run_id, partial


@dataclass
class RunMeta:
    """Who and what an AI call is about (stored on the AI run)."""

    project_id: str | None = None
    user_id: str | None = None
    subject_type: str | None = None
    subject_id: str | None = None


@dataclass
class _Usage:
    model: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    started: float = field(default_factory=time.monotonic)

    def add(self, r) -> None:
        self.model = r.model or self.model
        if r.usage:
            self.tokens_in += r.usage.prompt_tokens or 0
            self.tokens_out += r.usage.completion_tokens or 0

    @property
    def latency_ms(self) -> int:
        return int((time.monotonic() - self.started) * 1000)


def _transient(e: Exception) -> bool:
    """Rate limits, timeouts, network and server errors are worth retrying; other 4xx are not."""
    return isinstance(e, (openai.APIConnectionError, openai.RateLimitError, openai.InternalServerError))


def _hash(messages: list[dict]) -> str:
    return hashlib.sha256(json.dumps(messages, sort_keys=True).encode()).hexdigest()


class AiClient:
    def __init__(self, settings: Settings, sessions: async_sessionmaker):
        key = settings.nvidia_api_key.get_secret_value() if settings.nvidia_api_key else ""
        self._api = AsyncOpenAI(api_key=key, base_url=settings.ai_base_url, max_retries=0) if key else None
        self.models: dict[ModelRole, str] = {
            "main": settings.ai_model_main,
            "fallback": settings.ai_model_fallback,
            "embed": settings.ai_model_embed,
            "ocr": settings.ai_model_ocr,
            "vision": settings.ai_model_vision,
        }
        self._sessions = sessions

    @property
    def enabled(self) -> bool:
        return self._api is not None

    async def structured(
        self,
        capability: str,
        prompt: Prompt,
        user_input: str,
        schema: type[BaseModel],
        meta: RunMeta,
        check: Callable[[BaseModel], list[str]] = lambda _: [],
    ) -> tuple[BaseModel, str, str]:
        """JSON answer validated by `schema`, then by `check` (real control IDs, quotes...).
        On failure the model gets one more attempt with the exact errors. Returns (value, run_id, model)."""
        system = (
            f"{BASE_RULES}\n\n{prompt.system}\n\nReturn only one JSON object that matches this JSON Schema, "
            f"with no text before or after it:\n{json.dumps(schema.model_json_schema())}"
        )
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user_input}]
        input_hash, usage = _hash(messages), _Usage()
        errors: list[str] = []
        partial: BaseModel | None = None
        try:
            for attempt in (1, 2):
                text = await self._complete(capability, messages, usage)
                try:
                    value = partial = schema.model_validate(parse_model_json(text))
                    errors = check(value)
                except (ValueError, ValidationError) as e:
                    errors = [f"{'.'.join(map(str, x['loc'])) or 'answer'}: {x['msg']}" for x in e.errors()] if isinstance(e, ValidationError) else [str(e)]
                if not errors:
                    run_id = await self._record(capability, prompt, input_hash, meta, usage, "succeeded",
                                                output=value.model_dump(mode="json"), validation={"attempts": attempt, "errors": []})
                    return value, run_id, usage.model
                messages += [
                    {"role": "assistant", "content": text},
                    {"role": "user", "content": "Your answer has these problems:\n- " + "\n- ".join(errors) + "\nReturn the corrected JSON object only."},
                ]
        except AiUnavailable as e:
            await self._record(capability, prompt, input_hash, meta, usage, "failed", error=str(e))
            raise
        run_id = await self._record(capability, prompt, input_hash, meta, usage, "rejected", validation={"attempts": 2, "errors": errors},
                                    output=partial.model_dump(mode="json") if partial else None)
        raise AiRejected(errors, run_id, partial)

    async def text(self, capability: str, prompt: Prompt, messages: list[dict], meta: RunMeta) -> tuple[str, str, str]:
        """Plain text answer. Returns (text, run_id, model)."""
        full = [{"role": "system", "content": f"{BASE_RULES}\n\n{prompt.system}"}, *messages]
        usage = _Usage()
        try:
            text = await self._complete(capability, full, usage)
        except AiUnavailable as e:
            await self._record(capability, prompt, _hash(full), meta, usage, "failed", error=str(e))
            raise
        run_id = await self._record(capability, prompt, _hash(full), meta, usage, "succeeded", output={"text": text})
        return text, run_id, usage.model

    async def stream(self, capability: str, prompt: Prompt, messages: list[dict], meta: RunMeta) -> AsyncIterator[tuple[str, dict]]:
        """Yields ("delta", {"text"}) as the answer is written, then ("done", {"run_id", "model", "text"})."""
        cap = CAPABILITIES[capability]
        full = [{"role": "system", "content": f"{BASE_RULES}\n\n{prompt.system}"}, *messages]
        usage, parts = _Usage(model=self.models[cap.models[0]]), []
        try:
            stream = await self._client().chat.completions.create(
                **self._body(cap, usage.model, full), stream=True, stream_options={"include_usage": True}, timeout=cap.timeout_s
            )
            async for chunk in stream:
                if chunk.usage:
                    usage.add(chunk)
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    parts.append(delta)
                    yield "delta", {"text": delta}
        except (openai.OpenAIError, AiUnavailable) as e:
            await self._record(capability, prompt, _hash(full), meta, usage, "failed", error=str(e), output={"text": "".join(parts)} if parts else None)
            raise AiUnavailable(str(e)) from e
        text = "".join(parts)
        run_id = await self._record(capability, prompt, _hash(full), meta, usage, "succeeded", output={"text": text})
        yield "done", {"run_id": run_id, "model": usage.model, "text": text}

    async def embed(self, texts: list[str], input_type: str, meta: RunMeta) -> list[list[float]]:
        """Embeddings for retrieval: input_type "passage" for indexed content, "query" for questions."""
        usage, vectors = _Usage(model=self.models["embed"]), []
        try:
            for i in range(0, len(texts), 32):
                for attempt in range(3):
                    try:
                        r = await self._client().embeddings.create(
                            model=usage.model, input=texts[i : i + 32], encoding_format="float", timeout=30,
                            extra_body={"input_type": input_type, "truncate": "END"},
                        )
                        break
                    except openai.OpenAIError as e:
                        if attempt == 2 or not _transient(e):
                            raise AiUnavailable(f"Embeddings failed: {type(e).__name__}") from e
                        await asyncio.sleep(2**attempt)
                vectors += [d.embedding for d in sorted(r.data, key=lambda d: d.index)]
                usage.tokens_in += r.usage.prompt_tokens if r.usage else 0
        except AiUnavailable as e:
            await self._record("embedding", Prompt(f"embed-{input_type}", 1, ""), _hash([{"n": len(texts)}]), meta, usage, "failed", error=str(e))
            raise
        if input_type == "passage":  # queries are recorded with the answer they serve
            await self._record("embedding", Prompt(f"embed-{input_type}", 1, ""), _hash([{"t": texts}]), meta, usage, "succeeded", output={"count": len(vectors)})
        return vectors

    # ─── Internals ────────────────────────────────────────────────

    async def _complete(self, capability: str, messages: list[dict], usage: _Usage) -> str:
        """Each model of the capability in order, each with its own transient-error retries."""
        cap = CAPABILITIES[capability]
        last: Exception | None = None
        for role in cap.models:
            model = self.models[role]
            for attempt in range(cap.retries + 1):
                try:
                    r = await self._client().chat.completions.create(**self._body(cap, model, messages), timeout=cap.timeout_s)
                    usage.add(r)
                    text = r.choices[0].message.content or ""
                    if not text.strip():
                        raise AiUnavailable("The model returned an empty answer")
                    return text
                except (openai.AuthenticationError, openai.PermissionDeniedError) as e:
                    raise AiUnavailable("The provider refused the API key") from e
                except (openai.OpenAIError, AiUnavailable) as e:
                    last = e
                    if attempt < cap.retries and _transient(e):
                        await asyncio.sleep(2**attempt + random.random() / 2)
                        continue
                    log.warning("%s: %s failed (%s), trying the next model", capability, model, type(e).__name__)
                    break
        raise AiUnavailable(f"No model answered: {type(last).__name__ if last else 'unknown'}")

    def _body(self, cap: Capability, model: str, messages: list[dict]) -> dict:
        return {
            "model": model,
            "messages": messages,
            "temperature": cap.temperature,
            "max_tokens": cap.max_tokens,
            **({"response_format": {"type": "json_object"}} if cap.json else {}),
            # NVIDIA chat templates: reasoning on or off (ignored by models without it).
            "extra_body": {"chat_template_kwargs": {"enable_thinking": cap.thinking}},
        }

    def _client(self) -> AsyncOpenAI:
        if self._api is None:
            raise AiUnavailable("The AI service has no NVIDIA_API_KEY")
        return self._api

    async def _record(self, capability: str, prompt: Prompt, input_hash: str, meta: RunMeta, usage: _Usage, status: str, **fields) -> str:
        run = AiRun(
            capability=capability, prompt_version=prompt.ref, catalog_version=catalog.VERSION, input_hash=input_hash,
            project_id=meta.project_id, user_id=meta.user_id, subject_type=meta.subject_type, subject_id=meta.subject_id,
            status=status, model=usage.model or None, tokens_in=usage.tokens_in or None, tokens_out=usage.tokens_out or None,
            latency_ms=usage.latency_ms, **fields,
        )
        if run.error:
            run.error = run.error[:4000]
        async with self._sessions() as session:
            session.add(run)
            await session.commit()
        return str(run.id)
