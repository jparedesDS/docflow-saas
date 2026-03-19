# DocFlow

Document management system for industrial engineering — built for EIPSA.

## Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI, Python 3.11+, pandas, openpyxl |
| **Frontend** | React 18, Tailwind CSS 3, Framer Motion |
| **Auth** | JWT (python-jose + bcrypt) |
| **Data** | Excel (openpyxl/pandas) — no SQL database |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- npm

### Local Development

```bash
# Backend
cd docflow/backend
cp .env.example .env   # edit with your credentials
pip install -r ../../requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd docflow/frontend
npm install
npm start              # http://localhost:3000
```

### Docker

```bash
cp docflow/backend/.env.example docflow/backend/.env
# Edit .env with your configuration

docker-compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT signing (required in production) | `docflow-dev-secret-change-me` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` |
| `ENV` | Environment (`development`/`production`) | `development` |
| `BACKUP_DEST` | Backup destination path | `./backups` |
| `PEDIDOS_BASE_PATH` | Base path for order folders | _(optional)_ |
| `IMAP_HOST` | IMAP server for email reading | `imap.soljem.com` |
| `SMTP_HOST` | SMTP server for email sending | `smtp.soljem.com` |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features | _(optional)_ |
| `DOCUSIGN_*` | DocuSign eSignature credentials | _(optional)_ |

## Architecture

```
docflow/
├── backend/           # FastAPI API server
│   ├── main.py        # App entry point + middleware + scheduler
│   ├── routers/       # API endpoints (21 modules)
│   ├── services/      # Business logic (24 modules)
│   ├── models/        # Pydantic schemas
│   ├── repositories/  # Data access (Excel singletons)
│   └── utils/         # Config, auth, logging, JSON store
├── frontend/          # React SPA
│   ├── src/pages/     # 24 page components
│   ├── src/components/# Reusable UI components
│   ├── src/contexts/  # Theme, i18n, Toast, Tenant
│   └── src/services/  # Axios API client
├── docker-compose.yml
└── requirements.txt
```

## API

All endpoints under `/api/v1/`. Protected by JWT (except `/auth/login`, `/health/*`).

Interactive docs at `/docs` (Swagger UI).

## License

Proprietary — EIPSA. All rights reserved.
