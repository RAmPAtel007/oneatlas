# OneAtlas — AI model discovery & intelligence

**Live:** https://oneatlas-silk.vercel.app · **API docs:** https://oneatlas-silk.vercel.app/api-docs

Discover, compare and evaluate AI models across labs and providers: specs, pricing, capabilities, benchmarks and where to run them. Built with real data that refreshes daily.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 7 · Zod · Recharts · Vitest

| | |
|---|---|
| Models | ~710 (585 active) from 83 labs |
| API listings | ~8,800 model × provider offerings across 307 providers |
| Benchmarks | 20 leaderboards, ~1,500 scores (Artificial Analysis, Design Arena) |

---

## Features

**Core**
- **Model discovery:** search, filter (lab, provider, type, capabilities, context, max price, deprecated) and sort (newest, price, context, intelligence, popularity). The URL is the state, so every view can be shared. Table and card views, pagination.
- **Model detail pages:** specs, official vs cheapest price, every provider listing with its own model ID, capabilities and modalities, benchmark scores with rank (`#5 of 58`), related models.
- **Comparison:** up to 4 models side by side, with the best value in each row highlighted. A selection tray keeps your picks across pages (saved in localStorage).
- **Rankings:** 20 benchmark leaderboards grouped by category, with an open-weights-only toggle.
- **Labs & providers directories:** each lab's models, releases and where they're served; each provider's catalog with price vs. reference.
- **Global search (Ctrl K):** typo-tolerant ("cluade" → Claude, "gemni" → Gemini) across models, labs and providers. Full keyboard navigation.

**Beyond the brief**
- 💸 **Cost calculator:** turns per-token prices into a monthly bill for a real workload (chatbot, RAG, coding agent…), including prompt-cache hit rate. On model pages it ranks providers; on compare it ranks models.
- 📈 **Price vs. intelligence chart:** every scored model plotted on a log price axis with the **Pareto frontier** drawn in. These are the models no other model beats on both price and quality.
- 🔎 **"Cheaper models with similar intelligence"** on every model page.
- 🧹 **Price data hygiene:**
  - $0 "subscription plan" and bundled listings are detected and excluded, so they can't make a frontier model look free.
  - Reseller outliers don't define the headline price: it's the lab's official price, or the median across providers.
- 🕒 **Price history:** every price change writes a `PriceSnapshot`, ready for trend charts as history builds up.
- 🔌 **Public REST API** (`/api/v1/*`), documented at `/api-docs`. It's the same API the UI's client components use.

---

## Architecture

```
               ┌──────────── Vercel Cron (daily) ───────────┐
models.dev ──┐ │                                            ▼
             ├─► fetch ─► Zod validate ─► normalize ─► diff-sync ─► PostgreSQL (Neon)
OpenRouter ──┘   (per-record safeParse)   (pure fns)   (Prisma)        │
                                                                       │
          Server Components ──► service layer ('use cache') ──► Prisma ┘
                 ▲                      ▲
   Browser ──────┘     REST /api/v1/* ──┘   ◄── client components (search, compare picker) & external users
```

```
src/
  app/                 routes: pages + /api/v1 route handlers + /api/cron/ingest
  components/          UI (server by default; "use client" only where interactive)
  lib/                 shared, framework-free code: query schemas, formatters, pareto
  server/
    db.ts              single Prisma client (driver adapter: node-postgres)
    http.ts            route() wrapper, consistent JSON errors, query validation
    services/          all read queries — the only place that talks to Prisma
    ingest/            schemas → normalize → benchmarks → pipeline
prisma/schema.prisma   data model + migrations
scripts/               local-db (embedded Postgres), ingest CLI
```

### Data model

```
Lab 1──* Model *──* Provider      (join = Offering: price, limits, provider's own model id)
Model 1──* BenchmarkScore *──1 Benchmark
Offering 1──* PriceSnapshot       IngestionRun (audit log of every sync)
```

The key distinction is between labs and providers:
- **Lab:** the company that makes a model (e.g. Meta makes Llama).
- **Provider:** a company that serves it over an API (e.g. Groq or Together), each with its own price and limits.

So a model appears once in `Model` and many times in `Offering`.

## Key technical decisions

| Decision | Why |
|---|---|
| **Real data, ingested** (models.dev + OpenRouter) instead of mock JSON | More credible, and it exercises real validation and normalization problems. |
| **Validate each record** with `safeParse` | One malformed upstream record is skipped and counted, not a failed sync. |
| **Pure `normalize()`** separate from DB writes | Fully unit-tested without a database. |
| **Canonical-ID resolution** with lab aliases (`qwen → alibaba`, `mistralai → mistral`) and `.`/`-` normalization | Different sources spell the same model differently; benchmarks must join to the right model. |
| **Diff-based offering sync** | About 9k listings are compared in memory. Only changed rows are written, and a re-run is a no-op (idempotent). |
| **Denormalized aggregates** (`inputPrice`, `providerCount`, `intelligenceScore` on `Model`), refreshed by one SQL `UPDATE … FROM (aggregate)` | The listing page filters and sorts on plain indexed columns. There's no `GROUP BY` per request. |
| **"Trusted price" rule** in SQL | Subscription plans and unexplained $0 listings are excluded. Only providers with a documented free tier can make a model "free". |
| **pg_trgm GIN indexes + `word_similarity` + `levenshtein`** | Fast `ILIKE '%q%'` plus typo tolerance, including swapped letters. |
| **Service layer with `'use cache'` + `cacheTag('catalog')`** | Pages and API share one cached code path. The cron job calls `revalidateTag('catalog')`. |
| **Cache Components / Partial Prerendering** | Static shells come straight from the CDN. Only URL-dependent parts stream, behind `<Suspense>`. |
| **URL as filter state** | Shareable, bookmarkable, back-button friendly, server-rendered. |
| **Shared Zod schemas** for API and pages | The UI and API can't disagree about valid input. The API returns 400 with per-param details; pages drop just the bad param. |
| **Floats for prices** | These are list prices for comparison, not ledger amounts, and floats serialize cleanly into the RSC cache. |

## Getting started

Requires Node 20+.

```bash
npm install
cp .env.example .env           # local defaults work as-is

npm run db:local               # terminal 1: real Postgres 17, no Docker needed (embedded-postgres)
npm run db:deploy              # apply migrations
npm run db:ingest              # pull ~10k listings from models.dev + OpenRouter (~5s)
npm run dev                    # http://localhost:3000
```

The local cluster's data lives in `%LOCALAPPDATA%/oneatlas` (or `~/.local/share/oneatlas`), outside the repo. Sync tools like OneDrive corrupt live database files.

| Script | |
|---|---|
| `npm test` | Vitest unit tests (normalization, benchmark matching, query parsing, Pareto) |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Deployment (Vercel + Neon)

1. Create a Neon project and copy the **pooled** connection string.
2. Locally, run migrations and the first ingest against it:
   `DATABASE_URL=<neon-url> npm run db:deploy && DATABASE_URL=<neon-url> npm run db:ingest`
3. Import the repo in Vercel and set the `DATABASE_URL` and `CRON_SECRET` environment variables.
4. Deploy. `vercel.json` schedules `/api/cron/ingest` daily. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

## API

The API is read-only JSON with no key required. Full reference: `/api-docs`.

```
GET /api/v1/models?q=claude&cap=reasoning,vision&sort=price&page=1
GET /api/v1/models/{lab}/{model}
GET /api/v1/compare?models=a/b,c/d
GET /api/v1/search?q=gemni
GET /api/v1/benchmarks/{slug}?limit=50&openWeights=true
GET /api/v1/labs[/{slug}]  ·  /api/v1/providers[/{slug}]  ·  /api/v1/value  ·  /api/v1/stats
```

Errors share one shape: `{ "error": { "code", "message", "details?" } }`.

## Data sources & attribution

- Catalog, prices, limits and capabilities: [models.dev](https://models.dev) (MIT).
- Benchmarks: Artificial Analysis indices and Design Arena Elo, via the public [OpenRouter](https://openrouter.ai) models API.

## Known limitations / next steps

- Price history UI. Snapshots are recorded, but trends need a few days of syncs.
- Natural-language search ("cheap vision model with 128k context") → structured filters, via an LLM.
- Throughput and latency per provider. Not available in the current sources.
