from fastapi import APIRouter, HTTPException

from services import backup_service

router = APIRouter()


@router.get("/status")
def backup_status():
    return backup_service.get_backup_status()


@router.post("/trigger")
def trigger_backup():
    try:
        result = backup_service.run_backup()
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Backup falló"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
