"""One-time generation of the APTISO implementation guides (clauses 4-10 and the 93 Annex A controls).

The guides are written by the main model in its own words: objective, what an auditor expects, examples of
evidence and common pitfalls. They never quote the standard. Each batch is validated (schema, list sizes, no
ISO/IEC 27001:2013 numbering, refs exactly as asked) and retried once with the errors. The result is reviewed
and committed as guides.json; the service never generates guides at run time.

    docker compose run --rm -v <repo>/apps/ai/app/catalog:/out ai python -m app.catalog.generate_guides /out/guides.json
"""

import asyncio
import json
import re
import sys

from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

from app import catalog
from app.config import get_settings

VERSION = "guides@1"
BATCH = 6
OLD_NUMBERING = re.compile(r"\bA\.(?:1[0-8]|9)\.\d+(?:\.\d+)?\b|\bA\.\d+\.\d+\.\d+\b")

SYSTEM = """You write implementation guides for ISO/IEC 27001:2022, for people who implement or audit an ISMS.
For each requirement you are given (a clause or an Annex A control, with its official title), write in your own words:
- "objective": 1 or 2 sentences on what the requirement is for and the risk it addresses.
- "auditor_expects": 3 to 5 short items an auditor typically checks.
- "evidence": 3 to 5 concrete examples of evidence (records, documents, screenshots, logs).
- "pitfalls": 2 to 4 common mistakes found in audits.
Rules: never quote or reproduce the text of the standard; explain it. Use only ISO/IEC 27001:2022 numbering (clauses 4 to 10, controls A.5.1 to A.8.34); never use 2013 numbers such as A.12.3.1. Be practical and specific; each item under 200 characters.
Return JSON: {"guides": [{"ref": "...", "objective": "...", "auditor_expects": [...], "evidence": [...], "pitfalls": [...]}]} with exactly the refs given, in the same order."""


class Guide(BaseModel):
    ref: str
    objective: str = Field(min_length=20, max_length=500)
    auditor_expects: list[str] = Field(min_length=3, max_length=5)
    evidence: list[str] = Field(min_length=3, max_length=5)
    pitfalls: list[str] = Field(min_length=2, max_length=5)


class Batch(BaseModel):
    guides: list[Guide]


def errors_of(batch: Batch, refs: list[str]) -> list[str]:
    errors = []
    if sorted(g.ref for g in batch.guides) != sorted(refs):
        errors.append(f"return one guide for each of these refs, no other: {refs}")
    for g in batch.guides:
        texts = [g.objective, *g.auditor_expects, *g.evidence, *g.pitfalls]
        errors += [f"{g.ref}: uses 2013 numbering ({m.group(0)})" for t in texts if (m := OLD_NUMBERING.search(t))]
        errors += [f"{g.ref}: item longer than 220 characters" for t in texts[1:] if len(t) > 220]
    return errors


async def generate(client: AsyncOpenAI, model: str, refs: list[str]) -> list[Guide]:
    asked = "\n".join(f"- {r}: {'Clause ' if r[0].isdigit() else 'Control '}{r} {catalog.title(r)}" for r in refs)
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": f"Requirements:\n{asked}"}]
    for attempt in (1, 2):
        res = await client.chat.completions.create(model=model, messages=messages, temperature=0.3, max_tokens=6000,
                                                   response_format={"type": "json_object"},
                                                   extra_body={"chat_template_kwargs": {"enable_thinking": False}})
        raw = res.choices[0].message.content or ""
        try:
            batch = Batch.model_validate_json(raw[raw.find("{"): raw.rfind("}") + 1])
            problems = errors_of(batch, refs)
        except ValidationError as e:
            problems = [f"invalid JSON for the schema: {err['loc']} {err['msg']}" for err in e.errors()[:8]]
        if not problems:
            return sorted(batch.guides, key=lambda g: refs.index(g.ref))
        print(f"  attempt {attempt} for {refs[0]}..{refs[-1]}: {problems[:3]}", flush=True)
        messages += [{"role": "assistant", "content": raw}, {"role": "user", "content": "Fix these problems and return the full JSON again:\n- " + "\n- ".join(problems)}]
    raise RuntimeError(f"guides rejected twice for {refs}")


async def main(out: str) -> None:
    s = get_settings()
    client = AsyncOpenAI(base_url=s.ai_base_url, api_key=s.nvidia_api_key.get_secret_value(), timeout=180)
    refs = list(catalog.CLAUSES) + list(catalog.CONTROLS)
    batches = [refs[i:i + BATCH] for i in range(0, len(refs), BATCH)]
    limit = asyncio.Semaphore(4)

    async def run(b: list[str]) -> list[Guide]:
        async with limit:
            try:
                guides = await generate(client, s.ai_model_main, b)
            except Exception as e:  # noqa: BLE001 - a rejected batch is retried one requirement at a time
                print(f"  batch {b[0]}..{b[-1]} failed ({e}); one by one", flush=True)
                guides = []
                for ref in b:
                    try:
                        guides += await generate(client, s.ai_model_main, [ref])
                    except Exception as e2:  # noqa: BLE001 - reported, the others are kept
                        print(f"  {ref} skipped: {e2}", flush=True)
            print(f"  done {b[0]}..{b[-1]} ({len(guides)})", flush=True)
            return guides

    results = await asyncio.gather(*(run(b) for b in batches))
    items = {g.ref: g.model_dump(exclude={"ref"}) for batch in results for g in batch}
    data = {"version": VERSION, "catalog": catalog.VERSION, "model": s.ai_model_main,
            "note": "APTISO's own implementation guides, written in its own words; not the text of ISO/IEC 27001.", "items": items}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f"{len(items)} guides -> {out}")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "guides.json"))
