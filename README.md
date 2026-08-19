# Redroom V2.4.1 — Open-Source Geopolitical Intelligence Platform

> **An initiative of [Owlink.ai](https://owlink.ai)** — *Stealth Intelligence for Gov and People*
> Built by **Alexsai** · Live at [redroom.live](https://redroom.live)

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-11-2596BE.svg)](https://trpc.io/)

![Redroom Dashboard](docs/screenshots/redroom-dashboard.webp)

Redroom is a **full-stack OSINT (Open-Source Intelligence) platform** built for geopolitical analysts, researchers, and intelligence professionals. It aggregates, classifies, and visualises open-source news and signals data across global regions — providing a structured, real-time intelligence picture without requiring access to classified systems.

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Architecture Overview](#architecture-overview)
5. [Quick Start](#quick-start)
6. [Environment Variables](#environment-variables)
7. [Project Structure](#project-structure)
8. [Data Models](#data-models)
9. [API Reference](#api-reference)
10. [Crawler & Mission System](#crawler--mission-system)
11. [CMS & Administration](#cms--administration)
12. [Deployment](#deployment)
13. [Contributing](#contributing)
14. [Security](#security)
15. [License](#license)

---

## Overview

Redroom provides a **command-and-control style intelligence dashboard** that aggregates open-source news from hundreds of media agencies worldwide, enriches articles with AI-assisted classification, and presents the resulting intelligence picture through a suite of analytical tools.

The platform is designed around the OSINT tradecraft workflow:

1. **Collection** — automated RSS crawlers harvest articles from curated news agencies across all global regions.
2. **Processing** — articles are parsed, deduplicated, sentiment-scored, and linked to facilities, countries, and threat categories.
3. **Analysis** — analysts access live feeds, trend dashboards, narrative trackers, satellite orbit data, and SIGINT signal maps.
4. **Dissemination** — intelligence is surfaced through a structured UI with region-level threat assessments, escalation indicators, and exportable reports.

---

## Key Features

| Module | Description |
|---|---|
| **Live Intel Feed** | Real-time article stream with sentiment, region, and threat classification |
| **Globe Selector** | Interactive 3-D globe with region-level threat overlays and animated intelligence indicators |
| **Crawler Missions** | Scheduled, configurable crawl missions targeting specific regions, topics, and source types |
| **Facilities Intelligence** | Tracked military, nuclear, energy, and infrastructure facilities with source linking |
| **Satellite Orbit Tracker** | Real-time orbital data for reconnaissance and communication satellites |
| **SIGINT Dashboard** | Signal intercept indicators and electronic intelligence summaries |
| **Narrative Engine** | AI-assisted detection of coordinated narratives and information operations |
| **Reference Checker** | Cross-source verification and citation integrity scoring |
| **Waiting List & Access Control** | Role-based access (analyst / admin) with approval workflow |
| **CMS Admin Panel** | Full content management: agencies, articles, facilities, missions, webhooks |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Three.js |
| **Backend** | Node.js, Express 4, tRPC 11 |
| **Database** | MySQL / TiDB (via Drizzle ORM) |
| **Build** | Vite 6, pnpm |
| **Testing** | Vitest |
| **Schema** | Drizzle Kit (migrations) |
| **Storage** | S3-compatible object storage |
| **Authentication** | JWT session cookies + role-based access control |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (React 19)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  Globe View  │  │  Intel Feed  │  │  Analysis Dashboards  │ │
│  │  (Three.js)  │  │  (Live tRPC) │  │  Orbit / SIGINT / CMS │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘ │
│         └─────────────────┴──────────────────────┘             │
│                        tRPC Client                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS / tRPC over JSON
┌─────────────────────────────▼───────────────────────────────────┐
│                      SERVER (Express + tRPC)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  appRouter   │  │  cmsRouter   │  │  Crawler / Scheduler  │ │
│  │  (public +   │  │  (admin-only │  │  missionScheduler.ts  │ │
│  │   protected) │  │   procedures)│  │  crawler.ts           │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘ │
│         └─────────────────┴──────────────────────┘             │
│                       server/db.ts                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │ Drizzle ORM
┌─────────────────────────────▼───────────────────────────────────┐
│                    MySQL / TiDB Database                        │
│  news_agencies · articles · facilities · crawl_missions         │
│  mission_runs · investigations · sigint_signals · orbit_data    │
└─────────────────────────────────────────────────────────────────┘
```

For the full architecture document, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Quick Start

### Prerequisites

- Node.js ≥ 22
- pnpm ≥ 9
- MySQL 8 or TiDB (serverless tier works)

### 1. Clone the repository

```bash
git clone https://github.com/Owlinkai/redroom.git
cd redroom
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

See the [Environment Variables](#environment-variables) section for a full description of each variable.

### 4. Push the database schema

```bash
pnpm db:push
```

This runs `drizzle-kit generate` followed by `drizzle-kit migrate` to apply all schema migrations to your database.

### 5. Start the development server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

---

## Environment Variables

All secrets and configuration values must be provided via environment variables. **Never commit a populated `.env` file.**

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | MySQL / TiDB connection string (`mysql://user:pass@host:port/db`) |
| `JWT_SECRET` | ✅ | Secret used to sign session cookies (min 32 chars, random) |
| `ADMIN_SECRET_KEY` | ✅ | Super-admin CMS access key (used for the `x-sa-token` header) |
| `AIS_API_KEY` | ✅ | AIS (Automatic Identification System) API key for vessel tracking |
| `VITE_APP_ID` | ✅ | OAuth application ID for user authentication |
| `OAUTH_SERVER_URL` | ✅ | OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | ✅ | OAuth login portal URL (frontend) |
| `BUILT_IN_FORGE_API_URL` | ✅ | LLM / AI service base URL (server-side) |
| `BUILT_IN_FORGE_API_KEY` | ✅ | Bearer token for LLM / AI service (server-side, never expose to client) |
| `VITE_FRONTEND_FORGE_API_URL` | ✅ | LLM / AI service base URL (client-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | ✅ | Bearer token for LLM / AI service (client-side, public-safe scope only) |
| `VITE_APP_TITLE` | ⬜ | Application display name (default: `Redroom`) |
| `VITE_APP_LOGO` | ⬜ | URL to application logo image |
| `OWNER_OPEN_ID` | ⬜ | Owner's OAuth open ID (used for owner-only notifications) |
| `OWNER_NAME` | ⬜ | Owner's display name |
| `VITE_ANALYTICS_ENDPOINT` | ⬜ | Analytics collection endpoint URL |
| `VITE_ANALYTICS_WEBSITE_ID` | ⬜ | Analytics website identifier |

> **Security note:** Variables prefixed with `VITE_` are bundled into the client-side JavaScript and are visible to end users. Never place private API keys or secrets in `VITE_` variables.

---

## Project Structure

```
redroom/
├── client/                     # React frontend
│   ├── public/                 # Static assets (favicon, robots.txt)
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── GlobeRegionSelector.tsx   # 3-D globe with Three.js
│   │   │   ├── DashboardLayout.tsx       # Sidebar dashboard shell
│   │   │   ├── AIChatBox.tsx             # AI chat interface
│   │   │   └── Map.tsx                   # Map integration component
│   │   ├── pages/              # Page-level route components
│   │   │   ├── Home.tsx                  # Landing / entry page
│   │   │   ├── IntelPlatform.tsx         # Main intelligence dashboard
│   │   │   ├── AdminCMS.tsx              # CMS admin panel
│   │   │   ├── Orbit.tsx                 # Satellite orbit tracker
│   │   │   └── tabs/                     # Dashboard tab components
│   │   ├── contexts/           # React contexts (auth, theme)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/trpc.ts         # tRPC client binding
│   │   ├── App.tsx             # Route definitions
│   │   └── index.css           # Global styles and design tokens
│
├── server/                     # Express + tRPC backend
│   ├── routers/                # Feature-specific tRPC routers
│   │   ├── cms.ts              # CMS admin procedures
│   │   ├── orbit.ts            # Satellite orbit data
│   │   ├── sigint.ts           # SIGINT signal procedures
│   │   ├── missions.ts         # Surveillance mission procedures
│   │   ├── narratives.ts       # Narrative engine procedures
│   │   ├── reference.ts        # Reference checker procedures
│   │   └── waitingList.ts      # Access request management
│   ├── routers.ts              # Root router (assembles all sub-routers)
│   ├── db.ts                   # Drizzle query helpers
│   ├── crawler.ts              # RSS crawl engine
│   ├── missionScheduler.ts     # Cron-based crawl mission scheduler
│   ├── narrativeEngine.ts      # AI narrative detection engine
│   ├── referenceChecker.ts     # Cross-source reference verification
│   ├── quotaEnforcement.ts     # Per-user API quota management
│   ├── rateLimiter.ts          # Request rate limiting
│   ├── auth.ts                 # Authentication helpers
│   └── storage.ts              # S3 file storage helpers
│
├── drizzle/                    # Database schema and migrations
│   ├── schema.ts               # Drizzle table definitions
│   ├── relations.ts            # Drizzle relation definitions
│   └── *.sql                   # Migration files
│
├── shared/                     # Shared types and constants
│   └── const.ts                # Cross-stack constants
│
├── ARCHITECTURE.md             # Detailed system architecture
├── CONTRIBUTING.md             # Contribution guidelines
├── SECURITY.md                 # Security policy and disclosure
├── CODE_OF_CONDUCT.md          # Community standards
├── LICENSE                     # MIT License
└── README.md                   # This file
```

---

## Data Models

The core data models are defined in `drizzle/schema.ts`. Below is a summary of the primary tables.

| Table | Purpose |
|---|---|
| `news_agencies` | Tracked media sources with region, bias, RSS feeds, and reliability score |
| `articles` | Crawled and classified news articles with sentiment, topics, and facility links |
| `facilities` | Military, nuclear, energy, and infrastructure facilities with geolocation |
| `crawl_missions` | Scheduled crawl configurations with cron schedule, targets, and creator info |
| `mission_runs` | Execution log for each crawl mission run with status, duration, and article counts |
| `investigations` | Analyst-created investigation threads linking articles and facilities |
| `verified_articles` | Articles that have passed cross-source reference verification |
| `sigint_signals` | SIGINT intercept records with frequency, classification, and geolocation |
| `country_intel_data` | Aggregated threat and intelligence metrics per country |
| `pipeline_webhooks` | Configurable outbound webhooks triggered by crawl pipeline stages |
| `waiting_list` | Access request queue with role, status, and approval workflow |

For the full schema with column definitions, see `drizzle/schema.ts`.

---

## API Reference

Redroom uses **tRPC** for all client-server communication. There are no traditional REST endpoints — all procedures are defined in `server/routers.ts` and its sub-routers.

### Procedure Categories

| Namespace | Access Level | Description |
|---|---|---|
| `auth.*` | Public | Session management (`me`, `logout`) |
| `agencies.*` | Public / Admin | News agency CRUD and crawl triggers |
| `articles.*` | Public / Analyst | Article queries, stats, trending topics |
| `facilities.*` | Public / Admin | Facility CRUD, enrichment, source linking |
| `cms.*` | Super-Admin | Full CMS management (missions, agencies, webhooks) |
| `orbit.*` | Analyst | Satellite orbit data and pass predictions |
| `sigint.*` | Analyst | SIGINT signal queries and analysis |
| `narratives.*` | Analyst | Narrative detection and tracking |
| `reference.*` | Analyst | Cross-source reference verification |
| `waitingList.*` | Public / Owner | Access request submission and management |

### Access Levels

- **Public** — no authentication required
- **Analyst** — requires a valid session cookie (authenticated user)
- **Admin** — requires `role: "admin"` on the user record
- **Super-Admin** — requires a valid `x-sa-token` header (CMS only)

---

## Crawler & Mission System

The crawler system consists of two components:

**`server/crawler.ts`** — the core RSS crawl engine. It fetches RSS feeds from a given news agency, parses articles, deduplicates against the database, scores sentiment, and inserts new records. It emits events on the `crawlEventBus` so the frontend can receive live updates via tRPC subscriptions.

**`server/missionScheduler.ts`** — the mission scheduling layer. Missions are stored in the `crawl_missions` table and define:

- A cron schedule (e.g., `*/30 * * * *` for every 30 minutes)
- Target regions, countries, topics, and source types
- Priority and classification level
- Creator information (which admin created the mission)

When a mission fires, the scheduler creates a `mission_runs` record, selects matching agencies, runs the crawler for each, and updates the run record with the result (articles found, new articles, duration, any errors). Manual triggers record the `triggeredBy: "manual"` flag and the admin username.

---

## CMS & Administration

The CMS requires super-admin authentication via a secret key. The route is not published in this documentation. It provides:

- **News Agencies** — add, edit, delete, and manually crawl agencies
- **Articles** — browse, search, and manage the article database
- **Facilities** — manage tracked facilities and their intelligence sources
- **Crawler Missions** — create, edit, pause, trigger, and monitor scheduled crawl missions with full run history and creator attribution
- **Webhooks** — configure outbound webhooks triggered by pipeline events
- **Waiting List** — review and approve/reject access requests

The CMS uses a dual-authentication model: the super-admin session is established via a secret key (not tied to any user account), providing an additional layer of separation between the public user system and the administrative backend.

---

## Deployment

Redroom is a single Node.js process that serves both the API and the built frontend assets. It is designed to run on any Node.js-compatible hosting platform.

### Build for production

```bash
pnpm build
pnpm start
```

### Docker (recommended)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm && pnpm install --frozen-lockfile
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

### Environment

- **Runtime:** Node.js 22+
- **Memory:** 512 MiB minimum recommended
- **Port:** Reads from `PORT` environment variable, defaults to `3000`
- **Database:** Requires an external MySQL 8 or TiDB instance (connection via `DATABASE_URL`)

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## Security

Please do not open public GitHub issues for security vulnerabilities. Read [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

**Redroom V2.4** is an initiative of [Owlink.ai](https://owlink.ai) — *Stealth Intelligence for Gov and People*

Built by **Alexsai** · © 2024–2026 Alexsai · Owlink.ai · Live at [redroom.live](https://redroom.live)
