from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services import transmittal_service

router = APIRouter()


class ProcessRequest(BaseModel):
    to: list[str]
    cc: list[str] = []
    status_overrides: dict[str, str] = {}


@router.get("/emails")
def list_emails(folder: str = Query("INBOX")):
    try:
        return transmittal_service.fetch_all_emails(folder)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/emails/{uid}/preview")
def preview_email(uid: str, folder: str = Query("INBOX")):
    try:
        return transmittal_service.preview_email(uid, folder)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/emails/{uid}/process")
def process_email(uid: str, req: ProcessRequest, folder: str = Query("INBOX")):
    try:
        result = transmittal_service.process_and_notify(uid, req.to, req.cc, folder, req.status_overrides)
        transmittal_service._save_processed(uid)
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/emails/{uid}/debug")
def debug_email(uid: str, folder: str = Query("INBOX")):
    from tnefparse import TNEF
    msg = transmittal_service.imap_service.fetch_email(uid, folder)
    parts = []
    tnef_info = None
    if msg.is_multipart():
        for part in msg.walk():
            ct = part.get_content_type()
            payload = part.get_payload(decode=True)
            parts.append({
                "content_type": ct,
                "size": len(payload) if payload else 0,
            })
            if ct == "application/ms-tnef" and payload:
                tnef = TNEF(payload)
                tnef_info = {
                    "htmlbody_len": len(tnef.htmlbody) if tnef.htmlbody else 0,
                    "rtfbody_len": len(tnef.rtfbody) if tnef.rtfbody else 0,
                    "body_len": len(tnef.body) if tnef.body else 0,
                    "attachments": [
                        {"name": a.name, "size": len(a.data) if a.data else 0}
                        for a in (tnef.attachments or [])
                    ],
                }
    return {"parts": parts, "tnef_info": tnef_info}


@router.get("/mappings")
def get_mappings():
    return transmittal_service.get_mappings()
