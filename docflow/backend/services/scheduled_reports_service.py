"""Scheduled reports management service.

CRUD over scheduled_reports.json + dynamic APScheduler integration.
Follows the same pattern as template_service.py.
"""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import structlog

from models.scheduled_report import (
    LastRunInfo,
    ScheduledReport,
    ScheduledReportUpdate,
)
from utils.config import USERS
from utils.json_store import read_json, write_json

logger = structlog.get_logger()

SCHEDULES_FILE = Path(__file__).resolve().parent.parent / "scheduled_reports.json"

# Module-level scheduler reference, set by sync_scheduler_jobs()
_scheduler_ref = None

DEFAULT_SCHEDULES: list[dict] = [
    {
        "id": "weekly-executive",
        "type": "executive",
        "title": "Resumen Ejecutivo Semanal",
        "description": "Email ejecutivo con KPIs y resumen IA",
        "enabled": True,
        "frequency": "weekly",
        "schedule": {"day_of_week": "mon", "hour": 8, "minute": 0},
        "recipients": {"to": [], "cc": []},
        "options": {"user_filter": "all"},
        "last_run": None,
    },
    {
        "id": "weekly-personal",
        "type": "personal",
        "title": "Resumen Personal Semanal",
        "description": "Email individual por doc controller con devoluciones",
        "enabled": True,
        "frequency": "weekly",
        "schedule": {"day_of_week": "mon", "hour": 8, "minute": 0},
        "recipients": {"to": [], "cc": []},
        "options": {"user_filter": "all"},
        "last_run": None,
    },
    {
        "id": "claims-reminder",
        "type": "claims",
        "title": "Recordatorio Reclamaciones",
        "description": "Resumen de pedidos pendientes de reclamar",
        "enabled": True,
        "frequency": "weekly",
        "schedule": {"day_of_week": "thu", "hour": 8, "minute": 0},
        "recipients": {"to": [], "cc": []},
        "options": {"user_filter": "all"},
        "last_run": None,
    },
    {
        "id": "monthly-pdf",
        "type": "monthly-pdf",
        "title": "Informe Mensual PDF",
        "description": "PDF ejecutivo generado el día 1 de cada mes",
        "enabled": False,
        "frequency": "monthly",
        "schedule": {"day_of_month": 1, "hour": 7, "minute": 0},
        "recipients": {"to": [], "cc": []},
        "options": {"user_filter": "all"},
        "last_run": None,
    },
]


# ── Persistence ──────────────────────────────────────────────────────────────

def _seed_defaults() -> list[dict]:
    """Create initial JSON, migrating env vars where applicable."""
    defaults = [dict(d) for d in DEFAULT_SCHEDULES]

    # Migrate WEEKLY_EXECUTIVE_RECIPIENTS env var
    exec_raw = os.getenv("WEEKLY_EXECUTIVE_RECIPIENTS", "")
    exec_list = [r.strip() for r in exec_raw.split(",") if r.strip()]
    if exec_list:
        defaults[0]["recipients"] = {"to": exec_list, "cc": []}

    # Migrate MONTHLY_REPORT_RECIPIENTS env var
    monthly_raw = os.getenv("MONTHLY_REPORT_RECIPIENTS", "")
    monthly_list = [r.strip() for r in monthly_raw.split(",") if r.strip()]
    if monthly_list:
        defaults[3]["recipients"] = {"to": monthly_list, "cc": []}
        defaults[3]["enabled"] = True

    _save(defaults)
    return defaults


def _load() -> list[dict]:
    if not SCHEDULES_FILE.exists():
        return _seed_defaults()
    return read_json(str(SCHEDULES_FILE), default=DEFAULT_SCHEDULES)


def _save(data: list[dict]) -> None:
    write_json(str(SCHEDULES_FILE), data)


# ── CRUD ─────────────────────────────────────────────────────────────────────

def list_schedules() -> list[ScheduledReport]:
    return [ScheduledReport(**s) for s in _load()]


def get_schedule(schedule_id: str) -> Optional[ScheduledReport]:
    for s in _load():
        if s["id"] == schedule_id:
            return ScheduledReport(**s)
    return None


def update_schedule(schedule_id: str, data: ScheduledReportUpdate) -> Optional[ScheduledReport]:
    schedules = _load()
    for i, s in enumerate(schedules):
        if s["id"] == schedule_id:
            updates = data.model_dump(exclude_none=True)
            # Nested models: merge dicts instead of replacing
            for key in ("schedule", "recipients", "options"):
                if key in updates and isinstance(updates[key], dict):
                    existing = s.get(key, {}) or {}
                    existing.update(updates[key])
                    updates[key] = existing
            s.update(updates)
            schedules[i] = s
            _save(schedules)
            _refresh_job(schedule_id)
            return ScheduledReport(**s)
    return None


def record_run(
    schedule_id: str,
    status: str,
    recipients_count: int = 0,
    error: Optional[str] = None,
) -> None:
    schedules = _load()
    for i, s in enumerate(schedules):
        if s["id"] == schedule_id:
            s["last_run"] = {
                "timestamp": datetime.now().isoformat(),
                "status": status,
                "recipients_count": recipients_count,
                "error": error,
            }
            schedules[i] = s
            _save(schedules)
            return


def get_team_users() -> list[dict]:
    return [
        {"initials": k, "nombre": v["nombre"], "email": v["emails"][0]}
        for k, v in USERS.items()
    ]


# ── Execution ────────────────────────────────────────────────────────────────

def execute_schedule(schedule_id: str) -> dict:
    """Execute a scheduled report on demand."""
    sched = get_schedule(schedule_id)
    if sched is None:
        return {"status": "error", "error": "Schedule not found"}

    to = sched.recipients.to if sched.recipients.to else None
    cc = sched.recipients.cc if sched.recipients.cc else None
    user_filter = sched.options.user_filter

    try:
        if sched.type == "executive":
            from services.weekly_summary_service import send_executive_email
            result = send_executive_email(to=to, cc=cc)
            count = len(result.get("recipients", []))

        elif sched.type == "personal":
            from services.weekly_summary_service import send_personal_emails
            result = send_personal_emails(to_cc=cc, user_filter=user_filter)
            count = result.get("count", 0)

        elif sched.type == "claims":
            from services.claims_reminder_service import run_claims_reminder
            result = run_claims_reminder(to=to, cc=cc)
            count = len(to) if to else 1

        elif sched.type == "monthly-pdf":
            result = _execute_monthly_pdf(to, cc)
            count = len(to) if to else 0

        else:
            record_run(schedule_id, "error", error=f"Unknown type: {sched.type}")
            return {"status": "error", "error": f"Unknown type: {sched.type}"}

        record_run(schedule_id, "success", recipients_count=count)
        return {"status": "success", "schedule_id": schedule_id, "result": result}

    except Exception as e:
        logger.error("schedule_execute_error", schedule_id=schedule_id, error=str(e))
        record_run(schedule_id, "error", error=str(e))
        return {"status": "error", "schedule_id": schedule_id, "error": str(e)}


def _execute_monthly_pdf(to: list[str] | None, cc: list[str] | None) -> dict:
    """Generate and optionally save the monthly PDF."""
    from services.pdf_report_service import generate_monthly_pdf

    now = datetime.now()
    month = now.month - 1 or 12
    year = now.year if now.month > 1 else now.year - 1
    pdf_bytes = generate_monthly_pdf(month, year)

    # Save to network if BACKUP_DEST configured
    dest = os.getenv("BACKUP_DEST", "")
    if dest:
        from pathlib import Path as _P
        _P(dest).mkdir(parents=True, exist_ok=True)
        fname = _P(dest) / f"Informe_{now.year}_{month:02d}.pdf"
        fname.write_bytes(pdf_bytes)

    return {"status": "generated", "month": month, "year": year, "size": len(pdf_bytes)}


def get_preview_html(schedule_id: str) -> Optional[str]:
    """Get HTML preview for a schedule."""
    sched = get_schedule(schedule_id)
    if sched is None:
        return None

    if sched.type == "executive":
        from services.weekly_summary_service import get_executive_preview
        return get_executive_preview()

    elif sched.type == "personal":
        from services.weekly_summary_service import get_personal_preview
        return get_personal_preview("JP")

    elif sched.type == "claims":
        from services.claims_reminder_service import get_claims_preview
        return get_claims_preview()

    elif sched.type == "monthly-pdf":
        from services.pdf_report_service import generate_preview_html
        now = datetime.now()
        month = now.month - 1 or 12
        year = now.year if now.month > 1 else now.year - 1
        return generate_preview_html(month, year)

    return None


# ── APScheduler integration ──────────────────────────────────────────────────

def sync_scheduler_jobs(scheduler) -> None:
    """Read JSON and create cron jobs for all enabled schedules."""
    global _scheduler_ref
    _scheduler_ref = scheduler

    for sched in list_schedules():
        _add_job_for(scheduler, sched)


def _add_job_for(scheduler, sched: ScheduledReport) -> None:
    """Add a single cron job to the scheduler."""
    if not sched.enabled:
        return

    job_id = f"sched_{sched.id}"

    def _run(sid=sched.id):
        execute_schedule(sid)

    if sched.frequency == "weekly":
        scheduler.add_job(
            _run,
            "cron",
            day_of_week=sched.schedule.day_of_week or "mon",
            hour=sched.schedule.hour,
            minute=sched.schedule.minute,
            id=job_id,
            replace_existing=True,
        )
    elif sched.frequency == "monthly":
        scheduler.add_job(
            _run,
            "cron",
            day=sched.schedule.day_of_month or 1,
            hour=sched.schedule.hour,
            minute=sched.schedule.minute,
            id=job_id,
            replace_existing=True,
        )


def _refresh_job(schedule_id: str) -> None:
    """Remove + re-add a single job after config change."""
    if _scheduler_ref is None:
        return

    job_id = f"sched_{schedule_id}"

    # Remove existing job if present
    existing = _scheduler_ref.get_job(job_id)
    if existing:
        _scheduler_ref.remove_job(job_id)

    # Re-add if still enabled
    sched = get_schedule(schedule_id)
    if sched and sched.enabled:
        _add_job_for(_scheduler_ref, sched)
