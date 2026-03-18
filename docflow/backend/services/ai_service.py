import os
from typing import Optional


def chat_with_context(messages: list, context_subject: str = "", context_body: str = "") -> str:
    """
    Llama a la API de Anthropic con historial de chat y contexto del email.
    messages: lista de {"role": "user"|"assistant", "content": "..."}
    Retorna el texto de la respuesta del asistente.
    """
    from utils.config import ANTHROPIC_API_KEY
    import anthropic

    if not ANTHROPIC_API_KEY:
        return "Error: ANTHROPIC_API_KEY no configurada. Añade la clave en el archivo .env del backend."

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    system_prompt = (
        "Eres un asistente especializado en gestión documental técnica industrial para EIPSA, "
        "empresa de ingeniería en el sector petroquímico y energético. "
        "Ayudas a redactar respuestas formales a emails relacionados con documentación de proyectos, "
        "pedidos de compra (POs), transmittals, planos, especificaciones técnicas y comunicaciones con clientes industriales. "
        "Tu tono es profesional, formal y conciso. Respondes siempre en el mismo idioma del email o en español si no está claro. "
        "NO inventas datos — si te falta información, lo indicas claramente. "
        "Cuando redactes una respuesta de email, la presentas lista para copiar/enviar, con saludo y despedida apropiados."
    )

    if context_subject or context_body:
        body_snippet = context_body[:3000] if context_body else ""
        system_prompt += (
            f"\n\nCONTEXTO DEL EMAIL ACTUAL:\n"
            f"Asunto: {context_subject}\n"
            f"Cuerpo (primeros 3000 caracteres):\n{body_snippet}"
        )

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    )
    return response.content[0].text


class AIService:
    """Servicio de IA para respuestas automáticas a emails."""

    RESPONSE_PROMPT = """Eres un asistente profesional de gestión documental industrial para EIPSA.
Tu tarea es analizar un hilo de email y generar una respuesta profesional.

REGLAS ESTRICTAS:
1. Solo usar información que aparece explícitamente en el hilo. NO inventar datos.
2. Si falta información para responder, indicar qué información se necesita.
3. Mantener tono formal y profesional.
4. Ser claro, conciso y directo.
5. Incluir referencia al documento si se menciona.
6. Si hay una solicitud de acción, confirmar qué se hará y cuándo.

CONTEXTO DEL HILO:
{email_thread}

DATOS ADICIONALES (si disponibles):
- Documento: {documento}
- Estado: {estado}
- Cliente: {cliente}

Genera la respuesta al email:"""

    SUMMARY_PROMPT = """Analiza la siguiente lista de documentos y genera un informe ejecutivo resumido.

DATOS:
{data}

Genera un informe con:
1. Total de documentos
2. Desglose por estado (pendientes, aprobados, reclamados, etc.)
3. Días promedio de retraso de documentos pendientes
4. Documentos críticos (más de 30 días pendientes)
5. Recomendaciones

Formato: profesional, claro, listo para enviar a dirección."""

    def generate_email_response(
        self,
        email_thread: str,
        documento: str = "N/A",
        estado: str = "N/A",
        cliente: str = "N/A",
    ) -> dict:
        """Genera prompt para respuesta automática a email."""
        prompt = self.RESPONSE_PROMPT.format(
            email_thread=email_thread,
            documento=documento,
            estado=estado,
            cliente=cliente,
        )
        # Para uso con taste-skill o API externa
        return {
            "prompt": prompt,
            "instructions": "Enviar este prompt a taste-skill o API de LLM para obtener respuesta.",
        }

    def generate_summary_prompt(self, documents: list) -> dict:
        """Genera prompt para resumen ejecutivo."""
        data_str = "\n".join([str(doc) for doc in documents[:50]])
        prompt = self.SUMMARY_PROMPT.format(data=data_str)
        return {
            "prompt": prompt,
            "instructions": "Enviar este prompt a taste-skill o API de LLM para obtener resumen.",
        }
