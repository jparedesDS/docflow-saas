"""Classification router — manage document sensitivity labels."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from utils.auth_middleware import get_current_user
from services.classification_service import (
    CLASSIFICATION_LEVELS,
    get_classification,
    set_classification,
)

router = APIRouter()


class ClassificationUpdate(BaseModel):
    level: str


@router.get("/{doc_ref}")
def get_doc_classification(doc_ref: str, user=Depends(get_current_user)):
    level = get_classification(user["tenant_id"], doc_ref)
    return {"document_ref": doc_ref, "level": level}


@router.put("/{doc_ref}")
def update_doc_classification(
    doc_ref: str,
    body: ClassificationUpdate,
    user=Depends(get_current_user),
):
    if body.level not in CLASSIFICATION_LEVELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid level. Must be one of: {', '.join(CLASSIFICATION_LEVELS.keys())}",
        )
    ok = set_classification(
        tenant_id=user["tenant_id"],
        document_ref=doc_ref,
        level=body.level,
        user_initials=user.get("initials", ""),
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"document_ref": doc_ref, "level": body.level}
