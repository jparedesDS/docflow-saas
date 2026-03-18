from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from models.scheduled_report import ScheduledReport, ScheduledReportUpdate
from services import scheduled_reports_service as svc

router = APIRouter()


@router.get("/", response_model=list[ScheduledReport])
def list_all():
    return svc.list_schedules()


@router.get("/team")
def team_users():
    return svc.get_team_users()


@router.get("/{schedule_id}", response_model=ScheduledReport)
def get_one(schedule_id: str):
    result = svc.get_schedule(schedule_id)
    if result is None:
        raise HTTPException(404, "Schedule not found")
    return result


@router.put("/{schedule_id}", response_model=ScheduledReport)
def update(schedule_id: str, data: ScheduledReportUpdate):
    result = svc.update_schedule(schedule_id, data)
    if result is None:
        raise HTTPException(404, "Schedule not found")
    return result


@router.post("/{schedule_id}/execute")
def execute(schedule_id: str):
    sched = svc.get_schedule(schedule_id)
    if sched is None:
        raise HTTPException(404, "Schedule not found")
    return svc.execute_schedule(schedule_id)


@router.get("/{schedule_id}/preview", response_class=HTMLResponse)
def preview(schedule_id: str):
    html = svc.get_preview_html(schedule_id)
    if html is None:
        raise HTTPException(404, "Schedule not found or preview unavailable")
    return HTMLResponse(content=html)
