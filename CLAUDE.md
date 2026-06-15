# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

DataPulse is a multi-channel product-scraping app. A user submits a "job" (a search query + filters for one channel — `amazon`, `ebay`, `google`, or `shopify`); the backend enqueues it, a per-channel background worker scrapes and filters results, and the frontend displays them. UK marketplaces are the default everywhere (amazon.co.uk, `EBAY_GB`, country `gb`).

Two packages, both managed with **pnpm**:
- `backend/` — Fastify API + BullMQ workers (TypeScript ESM, Node).
- `frontend/` — Next.js 16 App Router (React 19, Tailwind v4).

There is a **single shared `.env` at the repo root** (not inside `backend/`). `backend/src/env.ts` loads it via `../../.env` and validates it with Zod (the process exits if invalid); `drizzle.config.ts` loads it via `../.env`. Copy `.env.example` to `.env` to start.

## Commands

Infrastructure (Postgres + Redis) — required before running anything:
```bash
docker-compose up -d          # from repo root; needs POSTGRES_* + REDIS in .env
```

Backend (`cd backend`):
```bash
pnpm dev                      # API server (tsx watch), http://localhost:4000
pnpm worker:shopify           # run EACH worker in its own terminal — they are
pnpm worker:ebay              # separate processes, not started by the API server
pnpm worker:google
pnpm worker:amazon
pnpm build                    # tsc -> dist/
pnpm start                    # node dist/server.js (prod)
pnpm db:push                  # push schema to DB (drizzle-kit, no migration files)
pnpm db:generate              # generate SQL migration from schema changes
pnpm db:migrate               # apply migrations
pnpm db:studio                # Drizzle Studio
```

Frontend (`cd frontend`):
```bash
pnpm dev                      # Next dev server, http://localhost:3000
pnpm build
pnpm lint                     # eslint
```

There is **no test suite** in this repo — do not assume `pnpm test` exists.

## Architecture

### Job lifecycle (the core flow)
1. `POST /api/v1/jobs` (`backend/src/jobs/jobs.routes.ts`) — authenticates, rate-limits (10/min/user via Redis), validates the body against a Zod **discriminated union on `channel`** (`jobs.schema.ts`), checks queue depth, writes a `jobs` row, enqueues to the channel's BullMQ queue, and returns `202` with `{ jobId, status, queuePosition }`.
2. The channel **worker** (`backend/src/workers/<channel>.worker.ts`) consumes the job: marks it `running`, calls the **scraper**, marks it `filtering`, calls the **filter**, then persists results and marks `done` (or `error`/`timeout`). Progress is updated on the DB row at milestones.
3. The frontend **polls** `GET /jobs/:id` every 5s until the status is terminal, then fetches `GET /jobs/:id/results`. (Realtime is not wired up — `src/realtime/socket.ts` and `job-events.ts` are empty stubs despite `socket.io` being a dependency.)

Job status enum: `queued → running → filtering → done` (or `error` / `timeout`). Results can only be fetched, and jobs only deleted, once status is terminal (`done`/`error`/`timeout`).

### Per-channel structure
Each channel is implemented as four parallel files — adding/changing a channel means touching all of them plus `jobs.schema.ts`, `jobs.repository.ts`, and the `if (body.channel === ...)` branch in `jobs.routes.ts`:
- `src/queue/<channel>.queue.ts` — BullMQ `Queue`, job-data type, `add*Job`, depth/position helpers. Queue names use hyphens (e.g. `queue-amazon`), not colons.
- `src/workers/<channel>.worker.ts` — BullMQ `Worker`; orchestrates scrape → filter → persist.
- `src/scrapers/<channel>.scraper.ts` — fetches raw products and normalizes them to a channel-specific product shape.
- `src/filters/<channel>.filter.ts` — applies the job's filters; returns `{ filteredProducts, summary }`.

Scraping approach differs per channel: **Shopify** (HTTP + Playwright + DNS checks), **eBay** (official OAuth API — `services/ebay-oauth.service.ts`), **Google** (SerpApi), **Amazon** (Playwright headless; blocks aggressively, so concurrency is kept at 1 and jobs retry 3× with exponential backoff and a fresh browser each attempt — see `AmazonBlockedError`).

### Data layer
- Drizzle ORM over `postgres.js`. Single client/instance in `src/db/client.ts`; schema in `src/db/schema.ts` (`users`, `password_reset_tokens`, `jobs`, `results`).
- `jobs.filters` and `results.data` are `jsonb` — scraper/filter output is stored loosely; channel-specific shape lives in the TypeScript types, not the DB.
- All job/result queries go through `src/jobs/jobs.repository.ts` and are scoped by `userId`.

### Auth & conventions
- JWT Bearer auth. `src/auth/auth.middleware.ts` (`requireAuth`) verifies the token **and** re-checks the user still exists in the DB, then populates `request.user`. Used as a `preHandler` on protected routes.
- All routes return a consistent envelope: `{ success: true, data }` or `{ success: false, error: { code, message, details } }`. Throw `AppError` (`src/errors/app-error.ts`) for expected failures; the global handler in `src/plugins/error-handler.ts` maps `AppError` and `ZodError` to this shape.
- Backend is ESM with `"type": "module"`: **imports use `.js` extensions** even for `.ts` source files.
- Frontend calls the API through the typed client in `frontend/lib/api.ts` (base URL `NEXT_PUBLIC_API_BASE_URL`, default `http://localhost:4000/api/v1`); shared types in `frontend/lib/types.ts`. Auth state lives in `components/AuthProvider.tsx`. Results render through channel-specific tables under `components/results/` dispatched by `ResultsTable.tsx`.

### Config knobs
Most scraper limits/behaviour are env-driven and validated in `src/env.ts` (e.g. `AMAZON_WORKER_CONCURRENCY`, `AMAZON_MAX_PAGES`, `GOOGLE_SHOPPING_MAX_PAGES`, `EBAY_SEARCH_MAX_TOTAL`). eBay and SerpApi credentials are optional so the backend and other workers still boot without them — each worker validates what it needs at use time.
