# APTISO AI service

Internal FastAPI service with all of APTISO's AI logic. Only the NestJS backend calls it, with `X-Service-Token`. It has its own database (`aptiso_ai`, with pgvector) and never reads the business database. Architecture: [docs/APTISO-AI-PLAN.md](../../docs/APTISO-AI-PLAN.md) (local file).

## Setup (once)

1. Create the database and its role. Run this from the repository root, with Postgres running and a password of your choice:
   ```sh
   docker exec -i aptiso-postgres psql -U aptiso -d postgres -v ON_ERROR_STOP=1 -v ai_password='<password>' < apps/ai/scripts/create-database.sql
   ```
2. Copy `.env.example` to `.env` and fill it in:
   - `AI_DB_PASSWORD` is the password from step 1.
   - `AI_SERVICE_TOKEN` is a random value of at least 32 characters. Put the same value in `apps/backend/.env` as `AI_SERVICE_TOKEN`.

## Run

**With Docker** (from the repository root):
```sh
docker compose --profile ai up -d --build
```

**Locally**, for development with auto-reload:
```sh
cd apps/ai
python -m venv .venv
.venv\Scripts\pip install -r requirements-dev.txt      # Windows (Linux/macOS: .venv/bin/pip)
.venv\Scripts\alembic upgrade head
.venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Stop the Docker container first (`docker compose stop ai`), since both use port 8000.

## Check

| Request | Expected |
|---|---|
| `GET http://127.0.0.1:8000/v1/health/live` | `200 {"status":"ok"}`, no token needed |
| `GET /v1/health/ready` without the token | `401` |
| `GET /v1/health/ready` with `X-Service-Token` | `200`, database (pgvector) and Redis ok; `503` if one is down |
| `http://127.0.0.1:8000/docs` | API documentation |

## Tests

```sh
.venv\Scripts\python -m pytest -q
```
