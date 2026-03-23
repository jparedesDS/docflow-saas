"""Mi Mañana — Personal daily work inbox endpoint."""

from fastapi import APIRouter, Depends

from services.my_morning_service import MyMorningService
from utils.auth_middleware import get_current_user

router = APIRouter()

_service = MyMorningService()


@router.get("/")
def get_morning_data(user=Depends(get_current_user)):
    """Get personal morning briefing data for the authenticated user."""
    initials = user.get("initials", "")
    tenant_id = user.get("tenant_id", 0)
    return _service.get_morning_data(initials, tenant_id)
