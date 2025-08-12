# Yingyu — Teacher‑Centric English Learning Platform

Yingyu is a full‑stack TypeScript monolith (Next.js + Prisma + PostgreSQL) built explicitly for teachers. It combines a rigorous architecture with a scientific FSRS (Free Spaced Repetition Scheduler) core to deliver resilient, fast, and insightful tools for managing students, lessons, and spaced‑repetition‑driven vocabulary learning.

- Teacher‑first UX and APIs; students are the subject, not the user
- Immutable ReviewHistory for perfect FSRS reproducibility; cache is rebuildable
- Strict layered architecture (API → Workflows → Services → Exercises → Data)
- Soft‑delete protection by default via Prisma Client Extension
- Robust async job system with DB row‑level locking (FOR UPDATE SKIP LOCKED)
- Optimistic frontend powered by SWR and scoped client state via Zustand


## Quick Start

Prerequisites:
- Node 20+
- Docker (for local Postgres) or a PostgreSQL 15 instance

Local (recommended, with Docker Compose):
- Copy `.env` from `.env` example and ensure `DATABASE_URL` and `CRON_SECRET` are set
- Start stack and app in dev mode (hot reload, migrations, seed, then run):
  - `docker-compose up`
- Open the app at `http://localhost:3000`

Manual (without Docker):
- `npm ci`
- `npx prisma generate`
- Run migrations: `npx prisma migrate dev`
- Seed (if desired): `npx prisma db seed`
- Start dev server: `npm run dev`


## Authentication (Dev Placeholder)

- All API routes require an `X-Teacher-ID` header (UUID). In development, the frontend injects a mock value in `hooks/api/utils.ts`.
- The worker production endpoint (`POST /api/worker`) is secured with `Authorization: Bearer <CRON_SECRET>`.
  - In development you can trigger jobs manually via `POST /api/worker/run` (no auth; only enabled when `NODE_ENV !== 'production'`).


## Architecture Overview

Layers and responsibilities:
- API Layer (`app/api`): Validate inputs with Zod, authenticate via `X-Teacher-ID`, delegate strictly to workflows/services.
- Workflow Layer (`lib/workflows`): Orchestrates multi‑service user stories (e.g., onboarding a student + assigning a deck).
- Service Layer (`lib/actions`): Core business logic (students, sessions, content, FSRS, jobs). Enforces rules and transactions.
- Exercise Handling Layer (`lib/exercises`): Dispatcher → Handler → Operator engine that drives live session state transitions.
- Data & Engine Layer: Extended Prisma client (`lib/db.ts`) with soft‑delete, FSRS engine bridge (`lib/fsrs/engine.ts`), PostgreSQL.
- Async Processing: Database‑backed job queue processed by `lib/worker.ts`, triggered by cron or the dev endpoint.

Primary directories:
- `app/api/` — Next.js API routes; thin controllers that validate and delegate
- `lib/actions/` — Services: `students.ts`, `sessions.ts`, `content.ts`, `fsrs.ts`, `jobs.ts`
- `lib/exercises/` — Session exercise engine, handlers, and operators
- `lib/schemas.ts` — Zod schemas for validating inputs and configs
- `lib/worker.ts` — Background job processor (row‑level locking)
- `lib/db.ts` — Prisma Client with global soft‑delete extension
- `prisma/schema.prisma` — Database schema (single source of truth)


## Key Concepts

- Teacher as the user: Every API/UI optimizes the teacher’s workflow and cognitive load.
- Atomicity and resilience: Multi‑record operations run in `prisma.$transaction` and fail as a unit.
- History as source of truth: `ReviewHistory` is the immutable ledger; `StudentCardState` is a rebuildable cache.
- Async for long tasks: Deck initialization, FSRS optimization, cache rebuilds run as background jobs.


## Soft‑Delete Protection (`lib/db.ts`)

A global Prisma Client extension converts `delete`/`deleteMany` to `update`/`updateMany` with `isArchived: true` and automatically injects `where: { isArchived: false }` on all read/update/count queries for selected models. This means:
- Write code naturally (`prisma.student.delete(...)`), and it’s archived, not removed
- Reads automatically exclude archived records — no need to filter manually

Models protected include `Student`, `Unit`, `VocabularyDeck`, and exercise models.


## The Job System (`lib/worker.ts`, `lib/actions/jobs.ts`)

- Services create `Job` rows (`PENDING`) for long‑running tasks
- A secure worker endpoint grabs a batch with `FOR UPDATE SKIP LOCKED`, marks them `RUNNING`, processes, and marks `COMPLETED`/`FAILED`/`SKIPPED`
- Payloads are validated with Zod per job type

Built‑in job types (`prisma/schema.prisma`):
- `INITIALIZE_CARD_STATES` — Create initial `StudentCardState` for a student’s assigned deck
- `OPTIMIZE_FSRS_PARAMS` — Compute and persist optimal FSRS parameters from history
- `REBUILD_FSRS_CACHE` — Reconstruct `StudentCardState` deterministically from `ReviewHistory`
- `BULK_IMPORT_*` — Vocabulary, students, schedules

Triggering:
- Production: scheduler calls `POST /api/worker` with `Authorization: Bearer <CRON_SECRET>`
- Development: call `POST /api/worker/run` to process pending jobs on demand


## FSRS and Learning Steps (`lib/actions/fsrs.ts`)

- Learning steps for new/relearning cards (e.g., `['3m','15m','30m']`) are handled before full FSRS scheduling
- `FSRSService.recordReview`:
  - If in learning steps, records as `isLearningStep: true` in `ReviewHistory` and sets a short due
  - On graduation (or non‑learning states), uses FSRS engine (`fsrs-rs-nodejs`) to schedule next review and records standard history
- `ReviewHistory` distinguishes learning steps vs main FSRS reviews; optimization uses only non‑learning entries
- Rebuilding cache: `_rebuildCacheForStudent` reconstructs all `StudentCardState` from `ReviewHistory` + active FSRS params


## Live Session Engine

- `SessionService` orchestrates a session as a state machine inside a single DB transaction per submission
- `lib/exercises/dispatcher.ts` maps `UnitItemType` → handler (e.g., `VOCABULARY_DECK` → `vocabularyDeckHandler`)
- Handlers initialize progress, route actions to Operators, and decide completion
- Operators encapsulate small, focused business actions (e.g., `SUBMIT_RATING` → `submitRatingOperator`)

Vocabulary example:
- Initialize builds an initial queue from due + new cards and pins the initial card set for session predictability
- `REVEAL_ANSWER` switches stage to `AWAITING_RATING`
- `SUBMIT_RATING` calls `FSRSService.recordReview`, re‑computes the queue from the pinned initial set, and advances


## API Overview

Conventions:
- All requests include `X-Teacher-ID: <UUID>`
- Responses use a standard envelope from `lib/api-utils.ts`: `{ ok, data, error }`
- Inputs are validated with Zod at the boundary; 400 on validation errors

Selected endpoints:
- Sessions
  - `POST /api/sessions/start` — Start a session
    - Body: `{ studentId, unitId, configOverrides? }`
  - `POST /api/sessions/:sessionId/submit` — Submit an action
    - Body (union): `{ action: 'REVEAL_ANSWER', data?: {} }` or `{ action: 'SUBMIT_RATING', data: { rating: 1|2|3|4 } }`
- Students (FSRS)
  - `POST /api/students/:studentId/fsrs/optimize-parameters` — Enqueue parameter optimization job (202 Accepted)
  - `POST /api/students/:studentId/fsrs/rebuild-cache` — Enqueue cache rebuild job (if implemented)
- Worker
  - `POST /api/worker` — Production job runner (requires `Authorization: Bearer <CRON_SECRET>`)
  - `POST /api/worker/run` — Dev‑only manual trigger

See `openapi.yaml` for a broader endpoint inventory.


## Frontend Principles (App Router)

- SWR is the single source of truth for server data (`hooks/api/*`), using a shared `fetcher()` that injects `X-Teacher-ID`
- Optimistic UI: all mutations use `mutateWithOptimistic` to update cache immediately and rollback on failure
- Global client state (`hooks/stores/*`) is scoped and used for complex, cross‑component flows (e.g., live session)
- Presentational components are composed from `components/ui` primitives (`shadcn/ui`)


## Database

- Migrations live in `prisma/migrations`; run with `npx prisma migrate dev` (local) or `npx prisma migrate deploy` (CI/Prod)
- Seed scripts: `prisma/seed.ts` and `prisma/seed.js` (compose uses the JS variant)
- Key models:
  - `Student`, `Teacher`, `Unit`, `UnitItem`, `Session`
  - `VocabularyDeck`, `VocabularyCard`
  - `StudentDeck`, `StudentCardState`, `ReviewHistory`, `StudentFsrsParams`
  - `Job` (async processing), `Payment`, `ClassSchedule`


## Environment & Deployment

Important env vars:
- `DATABASE_URL` — PostgreSQL connection string
- `CRON_SECRET` — Bearer token required by the production worker route
- `NEXT_TELEMETRY_DISABLED` — set to `1` in production

Development with Docker:
- `docker-compose.yml` provisions Postgres, optional Redis, Adminer, and a dev Node container that installs deps, runs migrations + seed, and starts the dev server

Production:
- `Dockerfile` (multi‑stage) and `docker-compose.prod.yml` expect an image `ghcr.io/dev-mirzabicer/yingyu:<tag>` and provide Postgres/Redis wiring
- Configure a scheduler (e.g., Vercel Cron) to call `POST /api/worker` with the `CRON_SECRET`


## Contributing

- Follow the layering rules: API validates + delegates; Services hold business logic; Exercises encapsulate per‑type session logic
- Validate all incoming inputs with Zod (`lib/schemas.ts`)
- Use `prisma.$transaction` for multi‑record operations to guarantee atomicity
- Offload long tasks to the job system and implement internal worker methods (`_privateMethod` pattern) on the corresponding Service
- Respect soft‑delete semantics: never manually filter `isArchived` — the Prisma extension does it for you

For a deeper dive, read `AGENTS.md` (backend and frontend architecture guides).

