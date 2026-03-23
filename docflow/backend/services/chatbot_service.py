"""Chatbot service — conversational assistant backed by real DocFlow data."""

import structlog
from typing import Dict, List, Any

logger = structlog.get_logger("docflow.chatbot")

MAX_HISTORY = 10  # keep last N messages per user


class ChatbotService:
    """Manages chatbot conversations with real-time data context."""

    def __init__(self):
        self._histories: Dict[str, List[dict]] = {}
        self._client = None

    def _get_client(self):
        """Return a cached Anthropic client instance."""
        if self._client is None:
            from utils.config import ANTHROPIC_API_KEY
            if not ANTHROPIC_API_KEY:
                return None
            import anthropic
            self._client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        return self._client

    def ask(self, question: str, user_initials: str, tenant_id: str = "") -> str:
        """Ask the chatbot a question with real DocFlow data as context.

        1. Obtains a snapshot of real monitoring/analytics data
        2. Builds a system prompt with the JSON snapshot
        3. Maintains per-user conversation history (last MAX_HISTORY messages)
        4. Calls Claude Haiku with the context
        5. Returns the assistant response
        """
        client = self._get_client()
        if client is None:
            logger.warning("chatbot_no_api_key")
            return "Error: ANTHROPIC_API_KEY no configurada. Contacta al administrador."

        # Build data context
        snapshot = self._get_data_snapshot()
        system_prompt = self._build_system_prompt(snapshot, user_initials)

        # Manage conversation history (keyed by tenant:user to isolate tenants)
        history_key = f"{tenant_id}:{user_initials}" if tenant_id else user_initials
        history = self._histories.setdefault(history_key, [])
        history.append({"role": "user", "content": question})

        # Trim history to last MAX_HISTORY messages
        if len(history) > MAX_HISTORY:
            history[:] = history[-MAX_HISTORY:]

        try:
            response = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=system_prompt,
                messages=history,
            )
            answer = response.content[0].text
            history.append({"role": "assistant", "content": answer})

            # Trim again after adding the response
            if len(history) > MAX_HISTORY:
                history[:] = history[-MAX_HISTORY:]

            logger.info("chatbot_response", user=user_initials, q_len=len(question), a_len=len(answer))
            return answer

        except Exception as exc:
            logger.error("chatbot_error", user=user_initials, error=str(exc))
            # Remove the failed question from history
            if history and history[-1]["role"] == "user":
                history.pop()
            return f"Error al procesar la consulta: {str(exc)}"

    def clear_history(self, user_initials: str, tenant_id: str = "") -> None:
        """Clear conversation history for a user."""
        history_key = f"{tenant_id}:{user_initials}" if tenant_id else user_initials
        self._histories.pop(history_key, None)
        logger.info("chatbot_history_cleared", user=user_initials, tenant_id=tenant_id)

    def _get_data_snapshot(self) -> dict:
        """Obtain a snapshot of current monitoring and analytics data."""
        from repositories.instances import data_repo, consulta_repo
        from services.monitoring_service import MonitoringService
        from services.analytics_service import AnalyticsService

        monitoring_service = MonitoringService(data_repo, consulta_repo)

        snapshot: Dict[str, Any] = {}

        try:
            # KPIs from monitoring report
            report = monitoring_service.get_monitoring_report_sections()
            kpis = report.get("kpis", {})
            snapshot["kpis"] = {
                "total_documentos": kpis.get("total", 0),
                "aprobados": kpis.get("aprobados", 0),
                "enviados": kpis.get("enviados", 0),
                "devoluciones": kpis.get("devoluciones", 0),
                "criticos": kpis.get("criticos", 0),
                "criticos_15d": kpis.get("criticos_15d", 0),
                "sin_enviar": kpis.get("sin_enviar", 0),
                "pct_completado": kpis.get("pct_completado", 0),
                "media_dias_devolucion": kpis.get("media_dias_devolucion", 0),
            }

            # Status global summary (top 15 orders by urgency)
            status_global = report.get("status_global", [])
            snapshot["pedidos_resumen"] = [
                {
                    "pedido": p["pedido"],
                    "cliente": p["cliente"],
                    "total": p["total"],
                    "aprobados": p["aprobados"],
                    "pendientes": p["pendientes"],
                    "sin_enviar": p["sin_enviar"],
                    "reclamados": p["reclamados"],
                    "pct_completado": p["pct_completado"],
                    "criticos": p["criticos"],
                }
                for p in status_global[:15]
            ]

            # Analytics summary (per-client, per-responsible, urgencies)
            analytics = AnalyticsService()
            docs = report.get("all_docs", [])
            if docs:
                summary = analytics.get_analytics_summary(docs)
                snapshot["por_cliente"] = [
                    {"cliente": c["cliente"], "total": c["total"], "aprobados": c["aprobados"], "pct": c["pct"], "media_dias": c["media_dias"]}
                    for c in summary.get("por_cliente", [])[:10]
                ]
                snapshot["por_responsable_doc"] = [
                    {"responsable": r["responsable"], "total": r["total"], "aprobados": r["aprobados"], "pct": r["pct"], "criticos": r["criticos"]}
                    for r in summary.get("por_responsable_doc", [])[:10]
                ]
                snapshot["urgencias"] = summary.get("urgencias", [])[:5]
                snapshot["docs_riesgo"] = summary.get("docs_riesgo", 0)
                snapshot["a_vencer_3d"] = summary.get("a_vencer_3d", 0)

            # Total orders count
            consulta_data = consulta_repo.get_all()
            snapshot["total_pedidos"] = len(consulta_data) if consulta_data else 0

        except Exception as exc:
            logger.error("chatbot_snapshot_error", error=str(exc))
            snapshot["error"] = f"Error parcial al obtener datos: {str(exc)}"

        return snapshot

    def _build_system_prompt(self, snapshot: dict, user_initials: str) -> str:
        """Build the system prompt with data context."""
        import json

        data_json = json.dumps(snapshot, ensure_ascii=False, default=str, indent=2)

        return (
            "Eres el asistente inteligente de DocFlow, un sistema de gestion documental industrial "
            "para EIPSA (ingenieria petroquimica y energetica). "
            "Tienes acceso a datos REALES del sistema que se actualizan en cada consulta.\n\n"
            "REGLAS ESTRICTAS:\n"
            "1. SOLO usa los datos proporcionados abajo. NUNCA inventes numeros, fechas ni nombres.\n"
            "2. Si no tienes datos suficientes para responder algo, dilo claramente.\n"
            "3. Responde siempre en espanol, de forma concisa y profesional.\n"
            "4. Usa formato estructurado cuando sea util (listas, numeros, porcentajes).\n"
            "5. Si el usuario pregunta por algo fuera de la gestion documental, indica amablemente que solo puedes ayudar con DocFlow.\n"
            "6. Cuando cites datos, indica que son datos en tiempo real del sistema.\n\n"
            f"USUARIO ACTUAL: {user_initials}\n\n"
            f"DATOS REALES DEL SISTEMA (snapshot en tiempo real):\n"
            f"```json\n{data_json}\n```\n\n"
            "Terminologia clave:\n"
            "- 'Aprobado': documento aprobado por el cliente\n"
            "- 'Enviado': documento enviado, pendiente de respuesta del cliente\n"
            "- 'Devoluciones': documentos devueltos con comentarios (com. menores, com. mayores, rechazado)\n"
            "- 'Sin enviar': documentos aun no enviados al cliente\n"
            "- 'Critico': documento marcado como critico/urgente\n"
            "- 'Repsonsable': persona encargada del documento (typo intencionado en el sistema)\n"
            "- 'Responsable': comercial del pedido\n"
            "- 'pct_completado': porcentaje de documentos aprobados vs total\n"
        )
