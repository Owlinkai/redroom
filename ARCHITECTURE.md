# Redroom V2.4 — System Architecture

> **Owlink.ai** — *Stealth Intelligence for Gov and People* · Built by **Alexsai** · [redroom.live](https://redroom.live)

This document describes the technical architecture of the Redroom geopolitical intelligence platform: its system design, data flow, component map, and database schema overview.

---

## Table of Contents

1. [High-Level Overview](#high-level-overview)
2. [Request Lifecycle](#request-lifecycle)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Crawler & Mission System](#crawler--mission-system)
6. [Authentication & Access Control](#authentication--access-control)
7. [Database Schema Overview](#database-schema-overview)
8. [AI & LLM Integration](#ai--llm-integration)
9. [File Storage](#file-storage)
10. [Key Design Decisions](#key-design-decisions)

---

## High-Level Overview

Redroom is a **monorepo full-stack application** running as a single Node.js process. The Express server handles both the tRPC API layer and serves the Vite-built React frontend as static assets in production. This keeps deployment simple — one container, one port, no separate CDN configuration required for the core application.

```
Internet
    │
    ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Node.js Process (port 3000)                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Express Server                           │  │
│  │  /api/trpc/*  →  tRPC Router                               │  │
│  │  /api/oauth/* →  OAuth Callback Handler                    │  │
│  │  /*           →  Vite Static Assets (production)           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Mission Scheduler   │  │  Narrative Engine                │  │
│  │  (node-cron)         │  │  (background LLM analysis)       │  │
│  └──────────────────────┘  └──────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌──────────────────────┐
│  MySQL / TiDB   │          │  S3-compatible        │
│  Database       │          │  Object Storage       │
└─────────────────┘          └──────────────────────┘
```

---

## Request Lifecycle

A typical analyst request flows as follows:

1. The React client calls a tRPC procedure via `trpc.*.useQuery()` or `trpc.*.useMutation()`.
2. The tRPC client serialises the call as a JSON POST to `/api/trpc/<procedure>`.
3. The Express middleware deserialises the request and routes it to the appropriate tRPC router.
4. The router middleware validates the session cookie (`JWT_SECRET`) and resolves `ctx.user`.
5. The procedure handler calls a query helper in `server/db.ts` which executes a Drizzle ORM query.
6. The result is serialised with SuperJSON (preserving `Date` objects) and returned to the client.
7. The React component receives typed data via the tRPC React Query integration.

For **streaming responses** (LLM-assisted analysis), the server uses Server-Sent Events (SSE) via tRPC subscriptions.

---

## Frontend Architecture

The frontend is a **React 19 single-page application** built with Vite. Routing is handled by Wouter (lightweight, no React Router dependency).

### Page Structure

```
App.tsx (routes)
├── Home.tsx                  — Landing page and entry point
├── IntelPlatform.tsx         — Main intelligence dashboard
│   ├── GlobeRegionSelector   — Three.js 3-D globe with overlays
│   └── tabs/
│       ├── LiveTab.tsx       — Real-time article feed
│       ├── FetchingMonitor.tsx — Crawler status and mission monitor
│       ├── AnalysisTab.tsx   — Trend analysis and charts
│       ├── FacilitiesTab.tsx — Facility intelligence map
│       ├── SigintTab.tsx     — SIGINT signal dashboard
│       ├── OrbitTab.tsx      — Satellite orbit tracker
│       └── NarrativesTab.tsx — Narrative detection feed
├── AdminCMS.tsx              — CMS admin panel (super-admin only)
└── Orbit.tsx                 — Full-screen orbit visualisation
```

### State Management

There is no global state management library. All server state is managed by **tRPC + React Query** (via `@tanstack/react-query`). Local UI state uses `useState` and `useReducer`. The authentication state is provided by a `useAuth()` hook that reads from `trpc.auth.me.useQuery()`.

### Design System

The UI uses **shadcn/ui** components built on Radix UI primitives, styled with **Tailwind CSS 4**. The design language is a dark, high-contrast intelligence terminal aesthetic — dark backgrounds (`#080000` base), red accent colours, monospaced typography for data values, and subtle glow effects for status indicators.

---

## Backend Architecture

### Router Hierarchy

```
server/routers.ts  (appRouter)
├── auth.*          — Session management
├── agencies.*      — News agency CRUD and crawl triggers
├── articles.*      — Article queries and classification
├── facilities.*    — Facility intelligence
├── cms.*           — CMS admin procedures (super-admin)
├── orbit.*         — Satellite orbit data
├── sigint.*        — SIGINT signal procedures
├── missions.*      — Surveillance mission queries
├── narratives.*    — Narrative detection and tracking
├── reference.*     — Cross-source reference verification
├── system.*        — System health and notifications
└── waitingList.*   — Access request management
```

### Middleware Chain

Each tRPC procedure passes through one or more middleware layers:

| Middleware | Purpose |
|---|---|
| `publicProcedure` | No authentication required |
| `protectedProcedure` | Validates JWT session cookie; injects `ctx.user` |
| `adminProcedure` | Extends `protectedProcedure`; requires `ctx.user.role === "admin"` |
| `ownerOnly` (CMS) | Validates `x-sa-token` header; independent of user session |

### Database Layer (`server/db.ts`)

All database access goes through helper functions in `server/db.ts`. These functions accept typed parameters and return raw Drizzle row objects. Procedures in the routers call these helpers rather than constructing queries inline, keeping the router files focused on input validation and response shaping.

---

## Crawler & Mission System

The crawl system is the core data ingestion pipeline.

### Components

**`server/crawler.ts`** — The RSS crawl engine. Given a news agency record, it:
1. Fetches the RSS feed URL with a `RedroomBot/1.0` User-Agent.
2. Parses the XML feed using `rss-parser`.
3. Deduplicates articles against the database using URL hash matching.
4. Scores each article for sentiment (positive / neutral / negative) using keyword heuristics.
5. Classifies articles by topic, region, and threat level.
6. Inserts new articles and emits a `newArticle` event on the `crawlEventBus`.

**`server/missionScheduler.ts`** — The mission scheduling layer. On startup, it:
1. Loads all active missions from the `crawl_missions` table.
2. Registers a `node-cron` job for each mission's cron expression.
3. When a job fires, it creates a `mission_runs` record, selects matching agencies (filtered by region, topic, and source type), runs the crawler for each agency, and updates the run record with the result.

**`server/crawlEventBus.ts`** — A lightweight in-process event emitter that bridges the crawler to tRPC subscriptions, allowing the frontend to receive real-time article notifications without polling.

### Mission Data Flow

```
crawl_missions table
        │
        ▼
missionScheduler (node-cron)
        │  fires on cron schedule
        ▼
mission_runs (insert: status=running)
        │
        ▼
crawler.ts (for each matching agency)
        │  fetches RSS, parses, deduplicates
        ▼
articles table (insert new articles)
        │
        ▼
crawlEventBus.emit('newArticle')
        │
        ▼
tRPC subscription → React client (live feed update)
        │
        ▼
mission_runs (update: status=completed, articleCount, duration)
```

---

## Authentication & Access Control

Redroom uses a **dual-authentication model**:

### User Authentication (Analyst / Admin)

Standard users authenticate via OAuth. The OAuth callback at `/api/oauth/callback` exchanges the authorisation code for user info, creates or updates the user record in the `users` table, and issues a signed JWT session cookie. The cookie is `httpOnly`, `sameSite: lax`, and signed with `JWT_SECRET`.

Authenticated requests have `ctx.user` injected by the tRPC context builder (`server/_core/context.ts`). The `protectedProcedure` middleware throws `UNAUTHORIZED` if no valid session exists.

### Super-Admin Authentication (CMS)

The CMS uses a completely separate authentication mechanism that does not depend on the user table. A super-admin authenticates by providing the `ADMIN_SECRET_KEY`. On success, the server issues a time-limited base64-encoded token that is stored in `localStorage` and sent as the `x-sa-token` header on all CMS requests.

The `ownerOnly` middleware in `server/routers/cms.ts` and `server/routers/waitingList.ts` validates this token independently of the OAuth session. This separation means a compromise of a user account (even an admin account) cannot grant CMS access.

### Role Hierarchy

```
Public (unauthenticated)
    └── Analyst (authenticated user, role: "user")
            └── Admin (authenticated user, role: "admin")
                    └── Super-Admin (x-sa-token, CMS only)
```

---

## Database Schema Overview

The schema is defined in `drizzle/schema.ts` using Drizzle ORM. Below is a summary of the primary tables and their relationships. Column-level detail is intentionally omitted here — refer to `drizzle/schema.ts` for the full definition.

### Core Intelligence Tables

| Table | Key Columns | Relationships |
|---|---|---|
| `news_agencies` | id, name, country, region, bias, rssUrl, reliabilityScore | → articles (1:N) |
| `articles` | id, title, url, publishedAt, sentiment, topics, region, threatLevel | → news_agencies (N:1), → facilities (N:M) |
| `facilities` | id, name, type, country, lat, lng, classification | → articles (N:M) |
| `country_intel_data` | countryCode, threatLevel, escalationScore, lastUpdated | — |

### Crawl Pipeline Tables

| Table | Key Columns | Relationships |
|---|---|---|
| `crawl_missions` | id, name, cronExpression, targetRegions, targetTopics, createdBy, isActive | → mission_runs (1:N) |
| `mission_runs` | id, missionId, startedAt, status, articlesFound, newArticles, triggeredBy | → crawl_missions (N:1) |
| `pipeline_webhooks` | id, url, event, secret, isActive | — |

### Analysis Tables

| Table | Key Columns | Relationships |
|---|---|---|
| `investigations` | id, title, analystId, status, linkedArticles | → articles (N:M) |
| `verified_articles` | id, articleId, verificationScore, sources | → articles (N:1) |
| `sigint_signals` | id, frequency, classification, lat, lng, detectedAt | — |

### Access Management Tables

| Table | Key Columns | Relationships |
|---|---|---|
| `users` | id, openId, name, email, role, createdAt | — |
| `waiting_list` | id, name, email, role, status, notes | — |

---

## AI & LLM Integration

The LLM integration is used in two places:

**`server/narrativeEngine.ts`** — Periodically analyses recent articles to detect coordinated narratives, information operations, and messaging patterns. It calls the LLM with a structured prompt and a batch of recent article titles/summaries, then parses the JSON response to extract narrative clusters, confidence scores, and source attribution.

**Inline analysis procedures** — Several tRPC procedures in `server/routers.ts` use the LLM for on-demand tasks: article summarisation, threat assessment generation, and cross-source synthesis. These are always called server-side to keep API keys out of the browser.

The LLM helper (`server/_core/llm.ts`) wraps the underlying API call with retry logic, timeout handling, and structured JSON response parsing.

---

## File Storage

File storage uses an S3-compatible API via the helpers in `server/storage.ts`. The two primary helpers are:

- `storagePut(key, data, contentType?)` — uploads bytes to S3 and returns the public URL.
- `storageGet(key, expiresIn?)` — generates a presigned GET URL for private objects.

The S3 bucket is configured for public read access on uploaded objects, so returned URLs from `storagePut` can be used directly in `<img>` tags or API responses without additional signing. File keys are constructed with random suffixes to prevent enumeration.

---

## Key Design Decisions

**tRPC over REST** — Using tRPC eliminates the need for a separate API contract layer. Types flow end-to-end from the Drizzle schema through the router procedure to the React component with zero manual type definitions. This significantly reduces the surface area for type drift bugs.

**Single-process deployment** — Running the API and frontend server in a single Node.js process simplifies deployment, eliminates cross-origin complexity, and reduces infrastructure cost. The trade-off is that CPU-intensive background tasks (crawler, narrative engine) share the event loop with request handling. This is mitigated by keeping background tasks lightweight and rate-limited.

**Dual authentication** — Separating the CMS super-admin token from the OAuth user session ensures that the CMS is not accessible even if an OAuth provider is compromised or a user account is taken over. The `x-sa-token` is a short-lived, server-signed token that cannot be forged without `ADMIN_SECRET_KEY`.

**Drizzle ORM over raw SQL** — Drizzle provides type-safe query building with minimal runtime overhead. Unlike heavier ORMs, it does not use a connection pool abstraction — it works directly with the underlying MySQL2 driver, giving full control over connection management and query execution.

**Event-driven live feed** — The `crawlEventBus` pattern avoids polling for live article updates. The crawler emits events that are picked up by tRPC subscriptions (SSE), which push updates to connected clients. This keeps the live feed truly real-time without the overhead of WebSocket infrastructure.

---

*Redroom V2.4 is an initiative of [Owlink.ai](https://owlink.ai) — Stealth Intelligence for Gov and People · Built by Alexsai · © 2024–2026 Alexsai · Owlink.ai*
