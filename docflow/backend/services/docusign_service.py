"""
DocuSign eSignature REST API — JWT Server-to-Server integration.
Requires: PyJWT, cryptography, requests (ya instalado).
"""
import time
import uuid
import logging
from datetime import datetime, timezone, timedelta

import jwt
import requests

from utils.config import (
    DOCUSIGN_INTEGRATION_KEY,
    DOCUSIGN_USER_ID,
    DOCUSIGN_ACCOUNT_ID,
    DOCUSIGN_BASE_URL,
    DOCUSIGN_RSA_PRIVATE_KEY_PATH,
)

logger = logging.getLogger(__name__)

# ── Status color metadata (compartido con frontend) ──────────────────────────
STATUS_META = {
    "sent":       {"label": "Enviado",    "urgency": "medium"},
    "delivered":  {"label": "Entregado",  "urgency": "low"},
    "completed":  {"label": "Completado", "urgency": "none"},
    "declined":   {"label": "Rechazado",  "urgency": "high"},
    "voided":     {"label": "Anulado",    "urgency": "none"},
    "created":    {"label": "Borrador",   "urgency": "none"},
    "timed_out":  {"label": "Expirado",   "urgency": "high"},
}


class DocuSignService:
    """
    Accede a DocuSign eSignature REST API mediante JWT Server-to-Server.
    El token se renueva automáticamente cuando expira (cada 1 hora).
    """

    # ── Auth ──────────────────────────────────────────────────────────────────

    def __init__(self):
        self._token: str | None = None
        self._token_expiry: float = 0.0

    def _get_token(self) -> str:
        if self._token and time.time() < self._token_expiry - 300:
            return self._token

        if not DOCUSIGN_INTEGRATION_KEY or not DOCUSIGN_USER_ID:
            raise RuntimeError("DocuSign credentials not configured in .env")

        # Lee clave RSA privada
        try:
            with open(DOCUSIGN_RSA_PRIVATE_KEY_PATH, "r") as f:
                private_key = f.read()
        except FileNotFoundError:
            raise RuntimeError(
                f"DocuSign RSA private key not found at: {DOCUSIGN_RSA_PRIVATE_KEY_PATH}"
            )

        now = int(time.time())
        is_demo = "demo" in DOCUSIGN_BASE_URL
        auth_host = "account-d.docusign.com" if is_demo else "account.docusign.com"

        payload = {
            "iss": DOCUSIGN_INTEGRATION_KEY,
            "sub": DOCUSIGN_USER_ID,
            "aud": auth_host,
            "iat": now,
            "exp": now + 3600,
            "scope": "signature impersonation",
        }

        assertion = jwt.encode(payload, private_key, algorithm="RS256")

        token_url = f"https://{auth_host}/oauth/token"
        resp = requests.post(
            token_url,
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            timeout=10,
        )
        if not resp.ok:
            logger.error("DocuSign token error %s: %s", resp.status_code, resp.text)
            raise RuntimeError(f"DocuSign auth error {resp.status_code}: {resp.text}")
        resp.raise_for_status()
        data = resp.json()

        self._token = data["access_token"]
        self._token_expiry = time.time() + data.get("expires_in", 3600)
        logger.info("DocuSign: token renovado, expira en %ds", data.get("expires_in", 3600))
        return self._token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _base(self) -> str:
        return f"{DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/{DOCUSIGN_ACCOUNT_ID}"

    # ── Envelopes ─────────────────────────────────────────────────────────────

    def list_envelopes(
        self,
        status: str | None = None,
        days: int = 30,
    ) -> list[dict]:
        """Devuelve lista normalizada de sobres de los últimos `days` días."""
        if days > 3650:
            from_date = "2015-01-01T00:00:00Z"
        else:
            from_date = (
                datetime.now(timezone.utc) - timedelta(days=days)
            ).replace(hour=0, minute=0, second=0, microsecond=0).isoformat().replace("+00:00", "Z")

        params: dict = {
            "from_date": from_date,
            "include": "recipients",
        }
        if status:
            params["status"] = status

        resp = requests.get(
            f"{self._base()}/envelopes",
            headers=self._headers(),
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        envelopes = data.get("envelopes", [])
        return [self._map_envelope(e) for e in envelopes]

    def get_envelope(self, envelope_id: str) -> dict:
        """Detalle completo de un sobre: recipients + audit events."""
        resp = requests.get(
            f"{self._base()}/envelopes/{envelope_id}",
            headers=self._headers(),
            params={"include": "recipients,audit_events"},
            timeout=15,
        )
        resp.raise_for_status()
        return self._map_envelope(resp.json(), full=True)

    def get_envelope_document_url(self, envelope_id: str, document_id: str) -> str:
        """URL firmada para preview del documento (válida ~15 min)."""
        resp = requests.post(
            f"{self._base()}/envelopes/{envelope_id}/views/recipient",
            headers=self._headers(),
            json={
                "returnUrl": "https://localhost:3000",
                "authenticationMethod": "none",
                "email": "",
                "userName": "",
                "clientUserId": str(uuid.uuid4()),
            },
            timeout=15,
        )
        try:
            resp.raise_for_status()
        except Exception as e:
            logger.error("DocuSign get_envelope_document_url error: %s — %s", e, resp.text)
            raise
        return resp.json().get("url", "")

    def download_combined_pdf(self, envelope_id: str) -> bytes:
        """Descarga el PDF combinado (todos los documentos firmados) de un sobre completado."""
        headers = self._headers()
        headers["Accept"] = "application/pdf"
        resp = requests.get(
            f"{self._base()}/envelopes/{envelope_id}/documents/combined",
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.content

    # ── KPIs ─────────────────────────────────────────────────────────────────

    def get_kpis(self, days: int = 30) -> dict:
        """Conteos por estado + urgentes (pendientes > 7 días)."""
        envelopes = self.list_envelopes(days=days)
        counts: dict[str, int] = {s: 0 for s in STATUS_META}
        urgent = 0

        for env in envelopes:
            st = env.get("status", "created")
            counts[st] = counts.get(st, 0) + 1
            if env.get("urgency") == "high":
                urgent += 1

        return {
            "total": len(envelopes),
            "by_status": counts,
            "urgent": urgent,
            "days": days,
        }

    # ── Normalización ─────────────────────────────────────────────────────────

    def _map_envelope(self, raw: dict, full: bool = False) -> dict:
        status = raw.get("status", "created")
        meta = STATUS_META.get(status, {"label": status, "urgency": "none"})

        recipients_raw = raw.get("recipients", {})
        signers = recipients_raw.get("signers", [])
        recipients = [
            {
                "name": s.get("name", ""),
                "email": s.get("email", ""),
                "status": s.get("status", ""),
                "signed_at": s.get("signedDateTime"),
            }
            for s in signers
        ]

        result = {
            "id": raw.get("envelopeId", ""),
            "subject": raw.get("emailSubject", ""),
            "status": status,
            "status_label": meta["label"],
            "urgency": meta["urgency"],
            "sender": raw.get("sender", {}).get("email", ""),
            "sender_name": raw.get("sender", {}).get("userName", ""),
            "sent_at": raw.get("sentDateTime"),
            "completed_at": raw.get("completedDateTime"),
            "expires_at": raw.get("expireDateTime"),
            "recipients": recipients,
        }

        if full:
            events = raw.get("auditEvents", [])
            result["history"] = [
                {
                    "event": e.get("eventFields", [{}])[0].get("value", ""),
                    "date": e.get("logTime"),
                    "user": e.get("eventFields", [{}])[1].get("value", "") if len(e.get("eventFields", [])) > 1 else "",
                }
                for e in events
            ]

        return result


# Singleton
_service: DocuSignService | None = None


def get_docusign_service() -> DocuSignService:
    global _service
    if _service is None:
        _service = DocuSignService()
    return _service
