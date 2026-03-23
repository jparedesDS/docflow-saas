"""Attachments router — file upload, download, and management for documents."""

import io

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from utils.auth_middleware import get_current_user

router = APIRouter()


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{doc_ref}/upload")
async def upload_attachment(
    doc_ref: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload a file attachment to a document."""
    from services.storage_service import upload

    tenant_id = current_user.get("tenant_id", 1)
    user_initials = current_user.get("initials", "")
    try:
        file_bytes = await file.read()
        result = upload(
            tenant_id=tenant_id,
            document_ref=doc_ref,
            filename=file.filename,
            content_bytes=file_bytes,
            content_type=file.content_type or "application/octet-stream",
            uploaded_by=user_initials,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{doc_ref}/{filename}/download")
async def download_attachment(
    doc_ref: str,
    filename: str,
    current_user: dict = Depends(get_current_user),
):
    """Download a specific file attachment."""
    from services.storage_service import download

    tenant_id = current_user.get("tenant_id", 1)
    try:
        file_bytes = download(
            tenant_id=tenant_id,
            document_ref=doc_ref,
            filename=filename,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
