"""Attachments router — file upload, download, and management for documents."""

import io
import os
import re
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from utils.auth_middleware import get_current_user
from utils.upload_config import MAX_UPLOAD_SIZE, ALLOWED_MIME_TYPES

router = APIRouter()


def _sanitize_filename(filename: str) -> str:
    """Strip path components and dangerous characters from uploaded filename."""
    name = os.path.basename(filename)
    name = re.sub(r'[\x00-\x1f]', '', name)
    name = name.replace('..', '_')
    return name or 'unnamed_upload'


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/{doc_ref}")
async def list_attachments(
    doc_ref: str,
    current_user: dict = Depends(get_current_user),
):
    """List all attachments for a document."""
    from services.storage_service import list_files as fetch_attachments

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return fetch_attachments(tenant_id=tenant_id, document_ref=doc_ref)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{doc_ref}/upload")
async def upload_attachment(
    doc_ref: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a file attachment to a document."""
    from services.storage_service import upload

    # ── Validate MIME type — must propagate directly, not wrapped by try ──
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"File type not allowed: {file.content_type}",
        )

    tenant_id = current_user.get("tenant_id", 1)
    user_initials = current_user.get("initials", "")
    try:
        file_bytes = await file.read()

        # ── Validate file size ────────────────────────────────────────
        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large — max {MAX_UPLOAD_SIZE // (1024 * 1024)} MB",
            )

        result = upload(
            tenant_id=tenant_id,
            document_ref=doc_ref,
            filename=_sanitize_filename(file.filename or "unnamed"),
            content_bytes=file_bytes,
            content_type=file.content_type or "application/octet-stream",
            uploaded_by=user_initials,
        )
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{doc_ref}/{filename}/download")
async def download_attachment(
    doc_ref: str,
    filename: str,
    current_user: dict = Depends(get_current_user),
):
    """Download a specific file attachment."""
    decoded = urllib.parse.unquote(filename)
    if '..' in decoded or '/' in decoded or '\\' in decoded:
        raise HTTPException(status_code=400, detail="Invalid filename")

    from services.storage_service import download

    tenant_id = current_user.get("tenant_id", 1)
    try:
        file_bytes = download(
            tenant_id=tenant_id,
            document_ref=doc_ref,
            filename=filename,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")

    if file_bytes is None:
        raise HTTPException(status_code=404, detail="File not found")

    # Guess content type from extension
    import mimetypes
    content_type, _ = mimetypes.guess_type(filename)
    content_type = content_type or "application/octet-stream"

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{attachment_id}")
async def delete_attachment(
    attachment_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete an attachment."""
    from services.storage_service import delete_file as remove_attachment

    tenant_id = current_user.get("tenant_id", 1)
    try:
        remove_attachment(tenant_id=tenant_id, attachment_id=attachment_id)
        return {"detail": "Attachment deleted"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")
