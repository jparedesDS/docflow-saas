"""Service for generating AI-powered meeting minutes with project context."""

import structlog

from utils.config import ANTHROPIC_API_KEY
from utils.status_constants import ESTADOS_PENDIENTES
from repositories.instances import data_repo, consulta_repo
from services.monitoring_service import MonitoringService
from services.claim_service import ClaimService

logger = structlog.get_logger("docflow.meeting_minutes")


class MeetingMinutesService:
    """Generates formal meeting minutes using Claude AI with optional project context."""

    def __init__(self):
        self._monitoring = MonitoringService(data_repo, consulta_repo)
        self._claim_service = ClaimService()
        self._client = None

    def _get_client(self):
        """Return a cached Anthropic client instance."""
        if self._client is None:
            import anthropic
            if not ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY no configurada. Añade la clave en el archivo .env del backend.")
            self._client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        return self._client

    def prefill_context(self, client_name: str) -> dict:
        """
        Fetch relevant client context to pre-fill meeting minutes.

        Returns: {pending_docs: [...], recent_claims: [...], kpis: {...}}
        """
        if not client_name or not client_name.strip():
            return {"pending_docs": [], "recent_claims": [], "kpis": {}}

        client_name = client_name.strip()
        logger.info("prefill_context", client_name=client_name)

        # Get pending docs for this client
        all_docs = self._monitoring.get_monitoring_data(cliente=client_name)
        pending_estados = ESTADOS_PENDIENTES | {"sin enviar"}
        pending_docs = []
        for doc in all_docs:
            estado = str(doc.get("Estado", "") or "").strip().lower()
            if estado in pending_estados:
                pending_docs.append({
                    "pedido": doc.get("Nº Pedido", ""),
                    "doc_eipsa": doc.get("Nº Doc. EIPSA", ""),
                    "titulo": doc.get("Título", "") or doc.get("Material", ""),
                    "estado": doc.get("Estado", "") or "Sin Enviar",
                    "revision": doc.get("Nº Revisión", ""),
                    "fecha_prevista": str(doc.get("Fecha Prevista", "") or ""),
                })

        # Get recent claims
        recent_claims = []
        try:
            claimable = self._claim_service.get_claimable_docs()
            for doc in claimable:
                cliente_doc = str(doc.get("Cliente", "") or "").strip().lower()
                if client_name.lower() in cliente_doc or cliente_doc in client_name.lower():
                    recent_claims.append({
                        "pedido": doc.get("Nº Pedido", ""),
                        "doc_eipsa": doc.get("Nº Doc. EIPSA", ""),
                        "titulo": doc.get("Título", "") or doc.get("Material", ""),
                        "dias_devolucion": doc.get("Días Devolución", ""),
                    })
        except Exception as exc:
            logger.warning("claims_context_failed", error=str(exc))

        # KPIs summary
        total = len(all_docs)
        aprobados = sum(1 for d in all_docs if str(d.get("Estado", "") or "").strip().lower() == "aprobado")
        kpis = {
            "total_docs": total,
            "aprobados": aprobados,
            "pendientes": len(pending_docs),
            "claims_abiertos": len(recent_claims),
            "tasa_aprobacion": round(aprobados / total * 100, 1) if total > 0 else 0,
        }

        return {
            "pending_docs": pending_docs[:20],  # Limit to 20 most relevant
            "recent_claims": recent_claims[:10],
            "kpis": kpis,
        }

    def generate_minutes(self, reunion_data: dict, notes: str, context: dict = None) -> dict:
        """
        Generate formal meeting minutes using Claude AI.

        reunion_data: {titulo, fecha, asistentes, descripcion, ubicacion}
        notes: free-text notes taken during the meeting
        context: output of prefill_context (optional)
        Returns: {acta: "markdown text", decisiones: [...], acciones: [...]}
        """
        if not notes or not notes.strip():
            raise ValueError("Las notas de la reunión son obligatorias para generar el acta.")

        client = self._get_client()

        # Build the system prompt
        system_prompt = self._build_system_prompt()

        # Build the user message
        user_message = self._build_user_message(reunion_data, notes, context)

        logger.info(
            "generate_minutes",
            titulo=reunion_data.get("titulo", ""),
            notes_length=len(notes),
            has_context=context is not None,
        )

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        raw_response = response.content[0].text

        # Parse the structured response
        result = self._parse_response(raw_response)

        logger.info(
            "minutes_generated",
            titulo=reunion_data.get("titulo", ""),
            decisiones_count=len(result.get("decisiones", [])),
            acciones_count=len(result.get("acciones", [])),
        )

        return result

    def _build_system_prompt(self) -> str:
        return (
            "Eres un asistente especializado en redactar actas de reunión formales para EIPSA, "
            "empresa de ingeniería en el sector industrial (petroquímico y energético). "
            "Generas actas profesionales, claras y bien estructuradas en español.\n\n"
            "REGLAS:\n"
            "1. Usa SOLO la información proporcionada en las notas. NO inventes datos.\n"
            "2. Si algo no está claro en las notas, indícalo como '[pendiente de confirmar]'.\n"
            "3. Las actas deben ser formales pero legibles.\n"
            "4. Extrae decisiones y acciones concretas de las notas.\n"
            "5. Las acciones deben incluir asignado y fecha límite si se mencionan en las notas.\n\n"
            "FORMATO DE RESPUESTA (respeta EXACTAMENTE estos delimitadores):\n"
            "---ACTA---\n"
            "[Acta en formato markdown]\n"
            "---DECISIONES---\n"
            "[Una decisión por línea, prefijada con '- ']\n"
            "---ACCIONES---\n"
            "[Una acción por línea en formato: TITULO | ASIGNADO | FECHA_LIMITE | PRIORIDAD]\n"
            "Prioridad puede ser: alta, media, baja\n"
            "Si no hay asignado o fecha, usar 'Por asignar' y 'Por definir'\n"
        )

    def _build_user_message(self, reunion_data: dict, notes: str, context: dict = None) -> str:
        parts = []

        # Meeting info
        parts.append("## DATOS DE LA REUNIÓN")
        parts.append(f"- Título: {reunion_data.get('titulo', 'Sin título')}")
        parts.append(f"- Fecha: {reunion_data.get('fecha', 'No especificada')}")

        asistentes = reunion_data.get("asistentes", [])
        if isinstance(asistentes, list):
            asistentes_str = ", ".join(asistentes)
        else:
            asistentes_str = str(asistentes)
        parts.append(f"- Asistentes: {asistentes_str}")

        if reunion_data.get("ubicacion"):
            parts.append(f"- Ubicación: {reunion_data['ubicacion']}")
        if reunion_data.get("descripcion"):
            parts.append(f"- Descripción: {reunion_data['descripcion']}")

        # Notes
        parts.append("\n## NOTAS TOMADAS DURANTE LA REUNIÓN")
        parts.append(notes)

        # Optional context
        if context:
            kpis = context.get("kpis", {})
            pending = context.get("pending_docs", [])
            claims = context.get("recent_claims", [])

            if kpis or pending or claims:
                parts.append("\n## CONTEXTO DEL PROYECTO (referencia)")

                if kpis:
                    parts.append(f"- Total documentos: {kpis.get('total_docs', 0)}")
                    parts.append(f"- Aprobados: {kpis.get('aprobados', 0)}")
                    parts.append(f"- Pendientes: {kpis.get('pendientes', 0)}")
                    parts.append(f"- Tasa aprobación: {kpis.get('tasa_aprobacion', 0)}%")

                if pending:
                    parts.append("\nDocumentos pendientes relevantes:")
                    for doc in pending[:10]:
                        parts.append(
                            f"  - [{doc.get('doc_eipsa', '')}] {doc.get('titulo', '')[:50]} "
                            f"(Estado: {doc.get('estado', '')}, Rev: {doc.get('revision', '')})"
                        )

                if claims:
                    parts.append("\nReclamaciones abiertas:")
                    for claim in claims[:5]:
                        parts.append(
                            f"  - [{claim.get('doc_eipsa', '')}] {claim.get('titulo', '')[:50]} "
                            f"({claim.get('dias_devolucion', '')} días)"
                        )

        return "\n".join(parts)

    def _parse_response(self, raw: str) -> dict:
        """Parse the structured AI response into acta, decisiones, acciones."""
        acta = ""
        decisiones = []
        acciones = []

        # Split by delimiters
        if "---ACTA---" in raw:
            parts = raw.split("---ACTA---", 1)
            remaining = parts[1] if len(parts) > 1 else ""

            if "---DECISIONES---" in remaining:
                acta_part, remaining = remaining.split("---DECISIONES---", 1)
                acta = acta_part.strip()

                if "---ACCIONES---" in remaining:
                    dec_part, acc_part = remaining.split("---ACCIONES---", 1)
                    decisiones = [
                        line.strip().lstrip("- ").strip()
                        for line in dec_part.strip().splitlines()
                        if line.strip() and line.strip() != "-"
                    ]
                    acciones = self._parse_acciones(acc_part.strip())
                else:
                    decisiones = [
                        line.strip().lstrip("- ").strip()
                        for line in remaining.strip().splitlines()
                        if line.strip() and line.strip() != "-"
                    ]
            else:
                acta = remaining.strip()
        else:
            # Fallback: treat entire response as the acta
            acta = raw.strip()

        return {
            "acta": acta,
            "decisiones": decisiones,
            "acciones": acciones,
        }

    def _parse_acciones(self, text: str) -> list:
        """Parse action items from the AI response."""
        acciones = []
        for line in text.splitlines():
            line = line.strip().lstrip("- ").strip()
            if not line:
                continue

            parts = [p.strip() for p in line.split("|")]
            accion = {
                "titulo": parts[0] if len(parts) > 0 else line,
                "asignado": parts[1] if len(parts) > 1 else "Por asignar",
                "fecha_limite": parts[2] if len(parts) > 2 else "Por definir",
                "prioridad": parts[3].lower() if len(parts) > 3 else "media",
            }

            # Normalize priority
            if accion["prioridad"] not in ("alta", "media", "baja"):
                accion["prioridad"] = "media"

            acciones.append(accion)

        return acciones
