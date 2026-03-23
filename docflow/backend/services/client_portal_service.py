"""Client Portal service — read-only document access for external clients."""

import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import structlog

logger = structlog.get_logger("docflow.client_portal")

_IS_POSTGRES = os.getenv("STORAGE_BACKEND", "excel") == "postgres"


def _get_session():
    from db.database import SessionLocal
    return SessionLocal()


def generate_portal_token(
    tenant_id: int,
    client_name: str,
    contact_email: str,
    expires_days: int = 90,
) -> Optional[str]:
    """Generate a portal access token for a client. Returns the raw token."""
    if not _IS_POSTGRES:
        return None

    from db.models import ClientPortalAccess

    raw_token = f"portal_{secrets.token_urlsafe(32)}"
    token_hash = bcrypt.hashpw(raw_token.encode(), bcrypt.gensalt()).decode()

    session = _get_session()
    try:
        access = ClientPortalAccess(
            tenant_id=tenant_id,
            client_name=client_name,
            contact_email=contact_email,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
        )
        session.add(access)
        session.commit()
        return raw_token
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def validate_portal_token(raw_token: str) -> Optional[dict]:
    """Validate a portal token and return client info if valid."""
    if not _IS_POSTGRES:
        return None

    from db.models import ClientPortalAccess

    session = _get_session()
    try:
        accesses = session.query(ClientPortalAccess).filter(
            ClientPortalAccess.expires_at > datetime.now(timezone.utc),
        ).all()

        for access in accesses:
            if bcrypt.checkpw(raw_token.encode(), access.token_hash.encode()):
                return {
                    "id": access.id,
                    "tenant_id": access.tenant_id,
                    "client_name": access.client_name,
                    "contact_email": access.contact_email,
                }
        return None
    finally:
        session.close()


def list_portal_accesses(tenant_id: int) -> list:
    """List all portal access entries for a tenant."""
    if not _IS_POSTGRES:
        return []

    from db.models import ClientPortalAccess

    session = _get_session()
    try:
        accesses = session.query(ClientPortalAccess).filter(
            ClientPortalAccess.tenant_id == tenant_id,
        ).order_by(ClientPortalAccess.created_at.desc()).all()

        return [
            {
                "id": a.id,
                "client_name": a.client_name,
                "contact_email": a.contact_email,
                "expires_at": a.expires_at.isoformat() if a.expires_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in accesses
        ]
    finally:
        session.close()


def revoke_portal_access(tenant_id: int, access_id: int) -> bool:
    """Revoke a portal access by deleting it."""
    if not _IS_POSTGRES:
        return False

    from db.models import ClientPortalAccess

    session = _get_session()
    try:
        access = session.query(ClientPortalAccess).filter(
            ClientPortalAccess.id == access_id,
            ClientPortalAccess.tenant_id == tenant_id,
        ).first()
        if not access:
            return False
        session.delete(access)
        session.commit()
        return True
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_client_documents(tenant_id: int, client_name: str, status: str = "") -> list:
    """Get documents for a specific client (read-only)."""
    if not _IS_POSTGRES:
        return []

    from db.models import Document

    session = _get_session()
    try:
        query = session.query(Document).filter(
            Document.tenant_id == tenant_id,
            Document.data["Cliente"].astext == client_name,
        )

        docs = query.all()
        results = []
        for doc in docs:
            data = doc.data or {}
            if status and data.get("Estado", "") != status:
                continue
            results.append({
                "doc_eipsa": data.get("Nº Doc. EIPSA", ""),
                "titulo": data.get("Título", data.get("Titulo", "")),
                "estado": data.get("Estado", ""),
                "tipo_doc": data.get("Tipo Doc.", ""),
                "fecha_envio": data.get("Fecha Env. Doc.", ""),
                "fecha_prevista": data.get("Fecha Prevista", ""),
                "revision": data.get("Nº Revisión", ""),
                "dias_devolucion": data.get("Días Devolución", ""),
            })
        return results
    finally:
        session.close()


def get_client_dashboard(tenant_id: int, client_name: str) -> dict:
    """Get KPI dashboard for a client."""
    docs = get_client_documents(tenant_id, client_name)
    total = len(docs)
    aprobados = sum(1 for d in docs if "aprobado" in (d["estado"] or "").lower())
    pendientes = sum(1 for d in docs if d["estado"] in ("", "Enviado", "Comentado"))
    rechazados = sum(1 for d in docs if "rechazado" in (d["estado"] or "").lower())

    return {
        "client_name": client_name,
        "total": total,
        "aprobados": aprobados,
        "pendientes": pendientes,
        "rechazados": rechazados,
        "approval_rate": round(aprobados / total * 100, 1) if total > 0 else 0,
    }


def _build_timeline(data: dict) -> list:
    """Build a timeline of events from document JSONB data."""
    timeline = []

    # Creation / first known date
    fecha_creacion = data.get("Fecha Creación", data.get("Fecha Creacion", ""))
    if fecha_creacion:
        timeline.append({
            "date": str(fecha_creacion).split("T")[0],
            "event": "Documento creado",
            "type": "creation",
        })

    # Planned date
    fecha_prevista = data.get("Fecha Prevista", "")
    if fecha_prevista:
        timeline.append({
            "date": str(fecha_prevista).split("T")[0],
            "event": "Fecha prevista de entrega",
            "type": "planned",
        })

    # Send date
    fecha_envio = data.get("Fecha Env. Doc.", "")
    if fecha_envio:
        timeline.append({
            "date": str(fecha_envio).split("T")[0],
            "event": "Documento enviado al cliente",
            "type": "sent",
        })

    # Return / response date
    fecha_devolucion = data.get("Fecha Dev. Doc.", data.get("Fecha Devolución", ""))
    if fecha_devolucion:
        timeline.append({
            "date": str(fecha_devolucion).split("T")[0],
            "event": "Respuesta recibida del cliente",
            "type": "returned",
        })

    # Status change
    estado = data.get("Estado", "")
    if estado:
        fecha_estado = data.get("Fecha Estado", data.get("Fecha Dev. Doc.", ""))
        timeline.append({
            "date": str(fecha_estado).split("T")[0] if fecha_estado else "",
            "event": f"Estado: {estado}",
            "type": "status",
        })

    # Revision info
    revision = data.get("Nº Revisión", "")
    if revision and str(revision).strip():
        rev_num = str(revision).strip()
        try:
            if int(rev_num) > 0:
                timeline.append({
                    "date": str(fecha_envio).split("T")[0] if fecha_envio else "",
                    "event": f"Revisión {rev_num} emitida",
                    "type": "revision",
                })
        except (ValueError, TypeError):
            timeline.append({
                "date": str(fecha_envio).split("T")[0] if fecha_envio else "",
                "event": f"Revisión {rev_num} emitida",
                "type": "revision",
            })

    # Sort by date (empty dates go last)
    timeline.sort(key=lambda e: e["date"] or "9999-99-99")

    return timeline


def get_document_detail(tenant_id: int, client_name: str, doc_ref: str) -> dict:
    """Get detailed info for a single document including timeline/history."""
    if not _IS_POSTGRES:
        return {}

    from db.models import Document

    session = _get_session()
    try:
        doc = session.query(Document).filter(
            Document.tenant_id == tenant_id,
            Document.data["Cliente"].astext == client_name,
            Document.data["Nº Doc. EIPSA"].astext == doc_ref,
        ).first()

        if not doc:
            return {}

        data = doc.data or {}
        logger.info("portal_document_detail", doc_ref=doc_ref, client=client_name)
        return {
            "doc_eipsa": data.get("Nº Doc. EIPSA", ""),
            "titulo": data.get("Título", data.get("Titulo", "")),
            "estado": data.get("Estado", ""),
            "tipo_doc": data.get("Tipo Doc.", ""),
            "fecha_envio": data.get("Fecha Env. Doc.", ""),
            "fecha_prevista": data.get("Fecha Prevista", ""),
            "fecha_devolucion": data.get("Fecha Dev. Doc.", ""),
            "revision": data.get("Nº Revisión", ""),
            "dias_devolucion": data.get("Días Devolución", ""),
            "pedido": data.get("Nº Pedido", ""),
            "cliente": data.get("Cliente", ""),
            "responsable": data.get("Repsonsable", ""),
            "timeline": _build_timeline(data),
        }
    finally:
        session.close()
