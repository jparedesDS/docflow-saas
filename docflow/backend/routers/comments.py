"""Comments router — threaded comments on documents."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from utils.auth_middleware import get_current_user

router = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────


class CreateCommentRequest(BaseModel):
    content: str
    parent_id: int | None = None
    mentions: list = []


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/{doc_ref}")
async def list_comments(
    doc_ref: str,
    current_user: dict = Depends(get_current_user),
):
    """List all comments for a document."""
    from services.comment_service import list_comments as get_comments

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return get_comments(tenant_id=tenant_id, document_ref=doc_ref)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{doc_ref}")
async def create_comment(
    doc_ref: str,
    body: CreateCommentRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a new comment on a document."""
    from services.comment_service import create_comment as add_comment

    tenant_id = current_user.get("tenant_id", 1)
    try:
        return add_comment(
            tenant_id=tenant_id,
            document_ref=doc_ref,
            user_initials=current_user.get("initials", ""),
            user_name=current_user.get("username", ""),
            content=body.content,
            parent_id=body.parent_id,
            mentions=body.mentions,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Delete a comment."""
    from services.comment_service import delete_comment as remove_comment

    tenant_id = current_user.get("tenant_id", 1)
    try:
        remove_comment(
            tenant_id=tenant_id,
            comment_id=comment_id,
        )
        return {"detail": "Comment deleted"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{doc_ref}/count")
async def get_comment_count(
    doc_ref: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the number of comments for a document."""
    from services.comment_service import get_comment_count as count_comments

    tenant_id = current_user.get("tenant_id", 1)
    try:
        count = count_comments(tenant_id=tenant_id, document_ref=doc_ref)
        return {"doc_ref": doc_ref, "count": count}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Internal server error")
