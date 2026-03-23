"""Predictions router — SLA risk, order predictions, and document timeline endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query

from utils.auth_middleware import get_current_user
from services.sla_prediction_service import predict_risks, predict_document_risk
from services.enhanced_prediction_service import EnhancedPredictionService
from services.doc_timeline_service import DocTimelineService

router = APIRouter()

_enhanced = EnhancedPredictionService()
_timeline = DocTimelineService()


@router.get("/at-risk")
def get_at_risk_documents(
    limit: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
):
    """Get top documents at risk of missing SLA deadlines."""
    return predict_risks(user["tenant_id"], limit)


@router.get("/order-predictions")
def get_order_predictions(user=Depends(get_current_user)):
    """Get enhanced completion predictions for all active orders."""
    return _enhanced.predict_orders(user["tenant_id"])


@router.get("/timeline/{doc_ref:path}")
def get_doc_timeline(doc_ref: str, user=Depends(get_current_user)):
    """Get complete lifecycle timeline for a document."""
    result = _timeline.get_timeline(doc_ref, user["tenant_id"])
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/document/{doc_ref}")
def get_document_prediction(doc_ref: str, user=Depends(get_current_user)):
    """Get risk prediction for a specific document."""
    result = predict_document_risk(user["tenant_id"], doc_ref)
    if not result:
        raise HTTPException(status_code=404, detail="Document not found")
    return result
