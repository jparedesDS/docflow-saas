"""SLA Prediction service — identify documents at risk of missing deadlines."""

import os
from datetime import datetime, timezone
from typing import Optional


ESTADOS_PENDIENTES = {"", "Enviado", "Comentado", "Com. Menores", "Com. Mayores"}


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def _calculate_risk_score(doc_data: dict) -> dict:
    """Calculate a risk score (0-100) based on document attributes.

    Factors:
    - Days since submission (higher = more risk)
    - Days of return delay (higher = more risk)
    - Document marked as critical
    - Previous rejections in history
    - Status in pending states
    """
    score = 0
    reasons = []
    actions = []

    estado = doc_data.get("Estado", "")
    dias_envio = doc_data.get("Días Envío")
    dias_dev = doc_data.get("Días Devolución")
    critico = str(doc_data.get("Crítico", "")).strip().upper()
    historial = str(doc_data.get("Historial Rev.", ""))

    # Factor 1: Days waiting for client response
    try:
        days_waiting = float(dias_dev) if dias_dev else 0
    except (ValueError, TypeError):
        days_waiting = 0

    if days_waiting > 30:
        score += 35
        reasons.append(f"{int(days_waiting)} días sin respuesta del cliente")
        actions.append("Enviar reclamación urgente al cliente")
    elif days_waiting > 15:
        score += 20
        reasons.append(f"{int(days_waiting)} días esperando respuesta")
        actions.append("Considerar enviar recordatorio")
    elif days_waiting > 7:
        score += 10
        reasons.append(f"{int(days_waiting)} días en espera")

    # Factor 2: Total processing time
    try:
        total_days = float(dias_envio) if dias_envio else 0
    except (ValueError, TypeError):
        total_days = 0

    if total_days > 90:
        score += 20
        reasons.append(f"{int(total_days)} días desde envío inicial")
    elif total_days > 60:
        score += 10
        reasons.append(f"{int(total_days)} días de procesamiento")

    # Factor 3: Critical document flag
    if critico in ("SÍ", "SI", "YES", "TRUE", "1", "X"):
        score += 15
        reasons.append("Documento marcado como crítico")
        actions.append("Priorizar seguimiento")

    # Factor 4: Rejection history
    rejection_count = historial.lower().count("rechazado") + historial.lower().count("com. mayores")
    if rejection_count >= 2:
        score += 15
        reasons.append(f"Historial con {rejection_count} devoluciones previas")
        actions.append("Revisar comentarios del cliente antes de reenviar")
    elif rejection_count == 1:
        score += 8
        reasons.append("Una devolución previa en historial")

    # Factor 5: Pending status
    if estado in ESTADOS_PENDIENTES:
        score += 5
        if not estado:
            reasons.append("Sin enviar al cliente")
            actions.append("Enviar documento al cliente")

    # Cap at 100
    score = min(score, 100)

    if not reasons:
        reasons.append("Sin factores de riesgo identificados")
    if not actions:
        actions.append("Continuar seguimiento normal")

    return {
        "score": score,
        "reasons": reasons,
        "actions": actions,
    }


def predict_risks(tenant_id: int, limit: int = 20) -> list:
    """Get top documents at risk of missing SLA deadlines."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        # Excel mode: use repository
        try:
            from repositories.instances import data_repo
            df = data_repo.get_all()
            docs = df.to_dict("records") if hasattr(df, "to_dict") else []
        except Exception:
            return []
    else:
        from db.models import Document
        session = _get_session()
        try:
            rows = session.query(Document).filter(
                Document.tenant_id == tenant_id,
            ).all()
            docs = [row.data for row in rows]
        finally:
            session.close()

    results = []
    for doc_data in docs:
        estado = doc_data.get("Estado", "")
        # Only analyze non-approved documents
        if estado and "aprobado" in estado.lower():
            continue

        risk = _calculate_risk_score(doc_data)
        if risk["score"] > 0:
            results.append({
                "doc_eipsa": doc_data.get("Nº Doc. EIPSA", ""),
                "titulo": doc_data.get("Título", doc_data.get("Titulo", "")),
                "estado": estado,
                "cliente": doc_data.get("Cliente", ""),
                "pedido": doc_data.get("Nº Pedido", ""),
                "responsable": doc_data.get("Repsonsable", ""),
                "risk_score": risk["score"],
                "reasons": risk["reasons"],
                "actions": risk["actions"],
            })

    # Sort by risk score descending
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    return results[:limit]


def predict_document_risk(tenant_id: int, doc_ref: str) -> Optional[dict]:
    """Get risk prediction for a single document."""
    if os.getenv("STORAGE_BACKEND", "excel") != "postgres":
        try:
            from repositories.instances import data_repo
            df = data_repo.get_all()
            docs = df.to_dict("records") if hasattr(df, "to_dict") else []
            doc_data = next(
                (d for d in docs if d.get("Nº Doc. EIPSA") == doc_ref),
                None,
            )
        except Exception:
            return None
    else:
        from db.models import Document
        session = _get_session()
        try:
            row = session.query(Document).filter(
                Document.tenant_id == tenant_id,
                Document.data["Nº Doc. EIPSA"].astext == doc_ref,
            ).first()
            doc_data = row.data if row else None
        finally:
            session.close()

    if not doc_data:
        return None

    risk = _calculate_risk_score(doc_data)
    return {
        "doc_eipsa": doc_data.get("Nº Doc. EIPSA", ""),
        "titulo": doc_data.get("Título", doc_data.get("Titulo", "")),
        "estado": doc_data.get("Estado", ""),
        "risk_score": risk["score"],
        "reasons": risk["reasons"],
        "actions": risk["actions"],
    }
