import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from routers import (
    documents, emails, erp, claims, ai, reports, notifications,
    transmittals, analytics, inbox, agenda, docusign, personal,
    backup, health, auth, templates, polling, projects, search,
    schedules,
)
from utils.logging_config import setup_logging

setup_logging()

scheduler = BackgroundScheduler(timezone="Europe/Madrid")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from services.backup_service import run_backup
    from services.polling_service import poll_and_process
    from services.scheduled_reports_service import sync_scheduler_jobs

    # Infrastructure jobs (not user-configurable)
    scheduler.add_job(run_backup, "cron", hour=2, minute=0, id="daily_backup")
    scheduler.add_job(poll_and_process, "interval", minutes=15, id="imap_polling")

    # Dynamic report schedules from JSON config
    sync_scheduler_jobs(scheduler)

    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="DocFlow Industrial", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://10.80.200.150:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers originales
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(emails.router, prefix="/api/v1/emails", tags=["emails"])
app.include_router(erp.router, prefix="/api/v1/erp", tags=["erp"])
app.include_router(claims.router, prefix="/api/v1/claims", tags=["claims"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(transmittals.router, prefix="/api/v1/transmittals", tags=["transmittals"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(inbox.router, prefix="/api/v1/inbox", tags=["inbox"])
app.include_router(agenda.router, prefix="/api/v1/agenda", tags=["agenda"])
app.include_router(docusign.router, prefix="/api/v1/docusign", tags=["docusign"])
app.include_router(personal.router, prefix="/api/v1/personal", tags=["personal"])

# Nuevos routers A1-A4
app.include_router(backup.router, prefix="/api/v1/backup", tags=["backup"])
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(templates.router, prefix="/api/v1/templates", tags=["templates"])

# Nuevos routers B1, C1, C2
app.include_router(polling.router, prefix="/api/v1", tags=["polling"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
app.include_router(schedules.router, prefix="/api/v1/schedules", tags=["schedules"])


@app.get("/")
def root():
    return {"message": "DocFlow Industrial API", "version": "1.0.0"}
