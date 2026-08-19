# APTISO

AI-powered ISO 27001 compliance management platform. APTISO helps organizations achieve and maintain ISO 27001 certification by automating gap analysis, tracking compliance projects, managing risks and controls, and generating evidence — all guided by an AI assistant.

## Architecture

```
Browser
  -> Next.js (port 3000) -- REST --> NestJS (port 4000) -- Prisma --> PostgreSQL
       |                              |
       |                              +--> Nodemailer --> Mailhog (dev email)
       |                              +--> BullMQ --> Redis (queues)
       |                              +--> MinIO (file storage)
       +-- REST --> FastAPI --> pgvector + LLM API
```

**Monorepo (npm workspaces)** — one repo, shared packages, single install, parallel dev via `concurrently`.

```
aptiso/
├── apps/
│   ├── frontend/         Next.js 15 + TypeScript + Tailwind (shadcn/ui)
│   ├── backend/          NestJS 11 + Prisma + JWT auth
│   └── ai-service/       FastAPI + LangChain (AI service)
├── packages/
│   ├── shared-types/     Shared TS enums & types (roles, statuses)
│   └── ui/               Shared shadcn/ui components
├── docker/
│   └── postgres/         Postgres + pgvector config
├── Documents/            Architecture docs and stack decisions
├── docker-compose.yml    Infrastructure services
├── package.json          Workspace root (scripts, workspaces config)
└── .env.example          Environment variable template
```

## Tech Stack

| Layer         | Technology                                          |
|---------------|-----------------------------------------------------|
| Frontend      | Next.js 15 (App Router, RSC) + TypeScript           |
| UI            | Tailwind CSS v4 + shadcn/ui + Radix primitives      |
| Forms         | React Hook Form + Zod validation                    |
| State         | Zustand (auth store)                                |
| Backend       | NestJS 11 + TypeScript (REST)                       |
| Database      | PostgreSQL 16                                        |
| ORM           | Prisma 6                                            |
| Auth          | JWT (access + refresh tokens, HttpOnly cookies)     |
| Passwords     | argon2                                               |
| Email         | Nodemailer + Mailhog (dev)                          |
| API Docs      | Swagger / OpenAPI                                   |
| Containers    | Docker + Docker Compose                             |
| Queue         | BullMQ + Redis                                      |
| File Storage  | MinIO (S3-compatible)                               |
| AI Service    | FastAPI + LangChain / LlamaIndex                    |
| Vector DB     | pgvector (PostgreSQL extension)                     |
| CI/CD         | GitHub Actions                                      |

## Features

- **Auth**: register, login, logout, refresh tokens, email verification, forgot/reset password
- **Sessions**: view active sessions, revoke individual sessions, logout all devices
- **Profile**: view and update profile, change password
- **Security**: helmet headers, CORS, CSRF tokens, rate limiting, HttpOnly cookies, argon2 password hashing
- **Audit logging** for compliance-relevant actions
- **Multi-org scoping** — every query scoped by `organizationId` via NestJS guards

## Prerequisites

- Node.js >= 20
- npm >= 10
- Docker + Docker Compose (for PostgreSQL, Mailhog, Redis)

## Getting Started

### 1. Clone and install

```sh
git clone <repo-url> aptiso
cd aptiso
npm install
```

### 2. Start infrastructure (PostgreSQL + Mailhog)

```sh
docker compose up -d
```

This starts:

| Service    | Port  | Purpose                            |
|------------|-------|------------------------------------|
| PostgreSQL | 5432  | Main database                      |
| Mailhog    | 1025  | SMTP (receives emails)             |
| Mailhog UI | 8025  | Web UI to view captured emails     |
| Redis      | 6379  | Queue backend                      |

To also start MinIO (file storage):
```sh
docker compose --profile minio up -d
```

### 3. Configure environment

```sh
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env` with your values. The defaults work with the Docker infrastructure above.

### 4. Set up database

```sh
npm run db:generate
npm run db:migrate
```

### 5. Run the app

Open two terminals from the project root:

**Terminal 1 — Backend (port 4000):**
```sh
npm run start:dev -w @aptiso/backend
```

**Terminal 2 — Frontend (port 3000):**
```sh
npm run dev -w @aptiso/frontend
```

### 6. Verify

| URL | What |
|-----|------|
| http://localhost:3000 | Frontend app |
| http://localhost:4000/api/docs | Swagger API documentation |
| http://localhost:8025 | Mailhog — view all emails sent by the backend |

### 7. Test the auth flow

1. Go to http://localhost:3000/register and create an account
2. Check http://localhost:8025 for the verification email
3. Click the verification link
4. Go to http://localhost:3000/login and sign in

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Run all workspaces in parallel |
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |
| `docker compose up -d` | Start infrastructure |
| `docker compose down` | Stop infrastructure |

## Backend API

All endpoints are prefixed with `/api/v1`. Full interactive docs at http://localhost:4000/api/docs.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/register` | POST | Create account |
| `/auth/login` | POST | Sign in (sets cookies) |
| `/auth/logout` | POST | Sign out |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/verify-email?token=` | GET | Verify email address |
| `/auth/me` | GET | Get current user profile |
| `/auth/profile` | PUT | Update profile |
| `/auth/change-password` | POST | Change password |
| `/auth/password-reset-request` | POST | Request password reset |
| `/auth/verify-reset-code` | POST | Verify reset code |
| `/auth/reset-password` | POST | Reset password |
| `/auth/sessions` | GET | List active sessions |
| `/auth/sessions/revoke` | POST | Revoke a session |
| `/auth/logout-all` | POST | Revoke all sessions |
| `/csrf/token` | GET | Get CSRF token |

## License

Private — All rights reserved.
