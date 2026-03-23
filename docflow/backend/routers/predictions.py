"""Predictions router — SLA risk prediction endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query

from utils.auth_middleware import get_current_user
from services.sla_prediction_service import predict_risks, predict_document_risk

router = APIRouter()


@router.get("/at-risk")
def get_at_risk_documents(
    limit: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
):
    """Get top documents at risk of missing SLA deadlines."""
    return predict_risks(user["tenant_id"], limit)


@router.get("/document/{doc_ref}")
def get_document_prediction(doc_ref: str, user=Depends(get_current_user)):
    """Get risk prediction for a specific document."""
    result = predict_document_risk(user["tenant_id"], doc_ref)
    if not result:
        raise HTTPException(status_code=404, detail="Document not found")
    return result
