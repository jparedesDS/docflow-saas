from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class ScheduleConfig(BaseModel):
    day_of_week: Optional[str] = None   # "mon","tue","wed","thu","fri","sat","sun"
    day_of_month: Optional[int] = None  # 1-28 (mensual)
    hour: int = 8
    minute: int = 0


class Recipients(BaseModel):
    to: list[str] = []
    cc: list[str] = []


class ScheduleOptions(BaseModel):
    user_filter: str | list[str] = "all"  # "all" o ["JP","AC",...]


class LastRunInfo(BaseModel):
    timestamp: str
    status: Literal["success", "error", "skipped"]
    recipients_count: int = 0
    error: Optional[str] = None


class ScheduledReport(BaseModel):
    id: str
    type: Literal["executive", "personal", "claims", "monthly-pdf"]
    title: str
    description: str
    enabled: bool = True
    frequency: Literal["weekly", "monthly"]
    schedule: ScheduleConfig
    recipients: Recipients = Recipients()
    options: ScheduleOptions = ScheduleOptions()
    last_run: Optional[LastRunInfo] = None


class ScheduledReportUpdate(BaseModel):
    enabled: Optional[bool] = None
    schedule: Optional[ScheduleConfig] = None
    recipients: Optional[Recipients] = None
    options: Optional[ScheduleOptions] = None
