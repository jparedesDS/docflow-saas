<p align="center">
  <img src="docs/screenshots/logo-docflow.png" alt="DocFlow Logo" width="120" />
</p>

<h1 align="center">DocFlow</h1>

<p align="center">
  <strong>Enterprise Document Management & Workflow Automation Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.104+-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" alt="License" />
</p>

<p align="center">
  Multi-tenant SaaS platform for industrial document control, automated email processing, workflow orchestration, and real-time analytics — built for engineering companies managing thousands of technical documents across multiple clients and projects.
</p>

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="800" />
  <br/>
  <em>Dashboard — Morning briefing, KPIs, and document status overview</em>
</p>

<p align="center">
  <img src="docs/screenshots/documents-hub.png" alt="Documents Hub" width="800" />
  <br/>
  <em>Documents Hub — Registry, kanban board, and batch operations</em>
</p>

<p align="center">
  <img src="docs/screenshots/project-dashboard.png" alt="Project Dashboard" width="800" />
  <br/>
  <em>Project Dashboard — Per-project tracking with progress bars and timelines</em>
</p>

<p align="center">
  <img src="docs/screenshots/workflows-hub.png" alt="Workflows Hub" width="800" />
  <br/>
  <em>Workflows Hub — Visual workflow builder with triggers, conditions, and actions</em>
</p>

<p align="center">
  <img src="docs/screenshots/status-global.png" alt="Status Global" width="800" />
  <br/>
  <em>Status Global — Real-time monitoring across all projects</em>
</p>

<p align="center">
  <img src="docs/screenshots/dark-mode.png" alt="Dark Mode" width="800" />
  <br/>
  <em>Full dark mode support with Industrial Indigo palette</em>
</p>

---

## Features

### Document Management
- **Document Registry** — Full CRUD with metadata, revisions, and lifecycle tracking
- **Kanban Board** — Visual document status management with drag-and-drop
- **Batch Operations** — Import/export Excel, bulk status updates
- **File Attachments** — Upload and link files to document records
- **Full-Text Search** — Unified search across documents, orders, and tags
- **Document Timeline** — Complete lifecycle history for each document

### Multi-Tenant Architecture
- **Row-Level Isolation** — Every table filtered by `tenant_id`
- **3 Pricing Tiers** — Free (3 users, 500 docs) | Pro (15 users, 10K docs) | Enterprise (unlimited)
- **Tenant Registration** — Self-service onboarding with organization setup
- **Superadmin Dashboard** — Manage all tenants, impersonation, usage analytics
- **Stripe Billing** — Checkout, customer portal, webhook-driven plan management

### Email Processing & Automation
- **IMAP Polling** — Automatic email ingestion every 15 minutes
- **6 Email Parsers** — Tecnicas Reunidas, GAIA, ACONEX, SENDOC, ProDoc, Docspace
- **TNEF Support** — Full winmail.dat extraction (HTML, RTF, TXT, attachments)
- **Email Assistants** — Preview parsed transmittals before processing
- **AI Email Responses** — Claude-powered draft generation

### Workflow Engine
- **Visual Builder** — Create workflows with triggers, conditions, and actions
- **Approval Flows** — Multi-step document approval with role-based routing
- **Scheduled Jobs** — Backup (2 AM), IMAP polling (15 min), claims reminders (Thursday), weekly summary (Monday), PDF reports (1st of month)

### AI-Powered Features
- **Document Chatbot** — Q&A over real monitoring data using Claude
- **Meeting Minutes** — Auto-generate formal minutes from notes via Claude Haiku
- **Email Response Generator** — AI-assisted email drafting with context
- **Anomaly Detection** — Automatic alerts for document irregularities
- **SLA Predictions** — Deadline prediction based on historical data

### Analytics & Reporting
- **Real-Time KPIs** — Document status, team workload, SLA compliance
- **Report Center** — Generate PDF reports with charts (ReportLab)
- **Scheduled Reports** — Automated report delivery via email
- **Supplier Scorecards** — Vendor performance tracking and ranking
- **Order Predictions** — Delivery date forecasting
- **Team Workload** — Resource allocation and bottleneck detection

### Communication
- **Real-Time Notifications** — Server-Sent Events (SSE) with browser push
- **Transmittal Management** — Track document transmittals across systems
- **Claims Management** — Automated claim reminders with escalation
- **Comments & Threads** — Collaborative discussion on documents
- **Client Portal** — External client access via secure token URL

### Enterprise
- **DocuSign Integration** — eSignature workflows
- **Network Folder Sync** — Monitor shared drives every 30 minutes
- **API Key Management** — Server-to-server auth with scoped keys
- **Webhook Configuration** — Event-driven integrations
- **Audit Logging** — Full traceability of all operations
- **Prometheus Metrics** — `/metrics` endpoint for monitoring
- **Health Checks** — Liveness and readiness probes

### Internationalization & Theming
- **Bilingual UI** — Spanish / English toggle
- **Dark Mode** — Full dark theme with CSS variables
- **Industrial Indigo Palette** — Professional color system with role-based accents

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Pydantic 2.0 |
| **Frontend** | React 18, Tailwind CSS 3, Framer Motion, Recharts |
| **Database** | PostgreSQL 16 (SQLAlchemy 2.0 + Alembic) — Excel fallback |
| **Cache** | Redis 7 |
| **Auth** | JWT (python-jose + bcrypt), API Keys |
| **Billing** | Stripe (Checkout, Portal, Webhooks) |
| **AI** | Anthropic Claude API (Haiku) |
| **Email** | IMAP4_SSL + SMTP_SSL, tnefparse, striprtf |
| **PDF** | ReportLab |
| **Icons** | Phosphor Icons, Heroicons |
| **Infra** | Docker Compose, APScheduler, structlog |
| **Monitoring** | Prometheus, structured logging |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React 18)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │Dashboard │ │Documents │ │Workflows │ │  33 Pages...  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│         Axios ──── Tailwind CSS ──── Framer Motion          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────┴────────────────────────────────────┐
│                      Backend (FastAPI)                       │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │  Auth   │ │ Routers  │ │ Services │ │  Middleware    │   │
│  │  JWT    │ │  (39)    │ │  (59)    │ │  CORS/Tenant  │   │
│  └─────────┘ └──────────┘ └──────────┘ └───────────────┘   │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐   │
│  │Workflow │ │  Email   │ │    AI    │ │  Schedulers   │   │
│  │ Engine  │ │ Parsers  │ │  Claude  │ │  APScheduler  │   │
│  └─────────┘ └──────────┘ └──────────┘ └───────────────┘   │
└──────┬───────────────┬──────────────────────┬───────────────┘
       │               │                      │
┌──────┴──────┐ ┌──────┴──────┐  ┌────────────┴────────────┐
│ PostgreSQL  │ │    Redis    │  │    External Services     │
│  16 + JSONB │ │    Cache    │  │ Stripe · Claude · IMAP   │
│  Row-level  │ │   Sessions  │  │ SMTP · DocuSign · S3     │
│  Tenancy    │ │             │  │                          │
└─────────────┘ └─────────────┘  └──────────────────────────┘
```

### Repository Pattern

```
BaseRepository (abstract)
├── ExcelRepository    ← STORAGE_BACKEND=excel   (pandas + TTL cache)
└── PostgresRepository ← STORAGE_BACKEND=postgres (JSONB + tenant_id filter)
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 16 *(optional — Excel mode available)*
- Redis 7 *(optional — for caching)*

### Backend

```bash
cd docflow/backend
pip install -r ../../requirements.txt

# Excel mode (single-tenant, no database needed)
uvicorn main:app --reload --port 8000

# PostgreSQL mode (multi-tenant)
export STORAGE_BACKEND=postgres
export DATABASE_URL=postgresql://user:pass@localhost:5432/docflow
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd docflow/frontend
npm install
npm start          # dev server on :3000
npm run build      # production build
```

### Docker (recommended)

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Services start on:
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

---

## Environment Variables

Create a `.env` file in `docflow/backend/` with your values:

| Variable | Description | Default |
|----------|-------------|---------|
| `STORAGE_BACKEND` | `excel` or `postgres` | `excel` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `JWT_SECRET` | Secret key for JWT tokens | *(required)* |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | `http://localhost:3000` |
| `IMAP_HOST` | IMAP server for email polling | — |
| `IMAP_USER` / `IMAP_PASS` | IMAP credentials | — |
| `SMTP_HOST` | SMTP server for sending emails | — |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials | — |
| `ANTHROPIC_API_KEY` | Claude API key for AI features | — |
| `STRIPE_SECRET_KEY` | Stripe secret key | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |
| `AWS_ACCESS_KEY_ID` | AWS key for S3 cloud backup | — |
| `AWS_SECRET_ACCESS_KEY` | AWS secret for S3 cloud backup | — |

---

## Project Structure

```
docflow/
├── backend/
│   ├── main.py                  # App entry, middleware, schedulers
│   ├── models/                  # SQLAlchemy ORM (17 tables)
│   ├── repositories/            # Data access layer (Excel / PostgreSQL)
│   ├── routers/                 # API endpoints (39 routers)
│   ├── services/                # Business logic (59 services)
│   │   └── parsers/             # Email parsers (6 systems)
│   ├── utils/                   # Config, encryption, cache, json_store
│   ├── alembic/                 # Database migrations
│   └── tests/                   # Test suite (500+ tests)
├── frontend/
│   └── src/
│       ├── App.js               # Main layout & navigation
│       ├── pages/               # 33 page components
│       ├── components/          # Shared UI components
│       ├── contexts/            # Theme, i18n, Toast, Tenant
│       ├── constants/           # Status colors, config
│       ├── hooks/               # Custom React hooks
│       ├── services/            # Axios API client
│       ├── translations/        # ES / EN translations
│       └── utils/               # Date formatting, helpers
├── docker-compose.yml           # Dev orchestration
├── docker-compose.prod.yml      # Production overrides
└── requirements.txt             # Python dependencies
```

---

## API Overview

All endpoints prefixed with `/api/v1/`. Interactive docs at `/docs` (Swagger UI).

| Module | Endpoints | Description |
|--------|:---------:|-------------|
| `/auth` | 3 | Login, refresh token, accept invite |
| `/documents` | 12 | CRUD, monitoring, batch, search |
| `/workflows` | 8 | Create, execute, approve, history |
| `/projects` | 6 | Project management & dashboard |
| `/notifications` | 3 | SSE stream, list, mark read |
| `/reports` | 5 | Generate, schedule, download PDF |
| `/analytics` | 4 | KPIs, trends, team metrics |
| `/tenants` | 4 | Register, manage, feature flags |
| `/billing` | 3 | Checkout, portal, webhooks |
| `/admin` | 5 | Superadmin, impersonation, usage |
| `/transmittals` | 3 | Parse, preview, process |
| `/claims` | 3 | List, create, remind |
| `/predictions` | 3 | SLA, orders, anomalies |
| `/chatbot` | 2 | AI Q&A over documents |
| `/portal` | 3 | Client portal (public) |
| `/health` | 2 | Liveness / readiness probes |
| `/metrics` | 1 | Prometheus metrics |

---

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Database Backup | Daily 2:00 AM | Full backup to local storage |
| IMAP Polling | Every 15 min | Fetch new emails from mailbox |
| Claims Reminder | Thursday | Auto-send pending claim notifications |
| Weekly Summary | Monday | Generate and email weekly report |
| PDF Report | 1st of month | Generate monthly PDF report |
| Folder Sync | Every 30 min | Scan network shared drives |

---

## Authentication

**JWT Tokens** — User sessions
```
POST /api/v1/auth/login
Body: { "username": "user", "password": "pass" }
→ { "access_token": "...", "refresh_token": "..." }

Header: Authorization: Bearer <access_token>
```

**API Keys** — Server-to-server
```
Header: X-API-Key: <api_key>
```

---

## Multi-Tenancy

Every data table includes a `tenant_id` column. All queries are automatically filtered by the authenticated user's tenant, ensuring complete data isolation.

| Plan | Users | Documents | Highlights |
|------|:-----:|:---------:|------------|
| **Free** | 3 | 500 | Core document management |
| **Pro** | 15 | 10,000 | + Workflows, AI, reports |
| **Enterprise** | Unlimited | Unlimited | + API keys, webhooks, SSO |

---

## License

Proprietary software. All rights reserved.

---

<p align="center">
  Built with FastAPI + React by <a href="https://github.com/jparedesDS">jparedesDS</a>
</p>
