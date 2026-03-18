from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic
import json

from services.monitoring_service import MonitoringService
from repositories.instances import data_repo, consulta_repo
from utils.config import ANTHROPIC_API_KEY

router = APIRouter()

SYSTEM_PROMPT = """Eres un asistente que traduce consultas en lenguaje natural a filtros JSON para buscar documentos de ingeniería.

El esquema de datos tiene estas columnas:
- "Nº Pedido" (str): número de pedido, ej. "24001"
- "Estado" (str): valores posibles: "Enviado", "Aprobado", "Rechazado", "Com. Menores", "Com. Mayores", "Comentado", o "" (vacío = sin enviar)
- "Cliente" (str): nombre del cliente
- "Responsable" (str): comercial del pedido
- "Repsonsable" (str): responsable del documento (iniciales como JP, AC, JM, EC, LB, SS, JV, CCH, LM)
- "Nº Doc. EIPSA" (str): número de documento EIPSA
- "Nº Doc. Cliente" (str): número de documento del cliente
- "Título" (str): título del documento
- "Tipo Doc." (str): tipo de documento
- "Crítico" (str): "Sí" o "No"
- "Días Devolución" (int): días desde el envío sin respuesta del cliente
- "Nº Revisión" (str): revisión del documento

Responde SOLO con un JSON válido con esta estructura:
{
  "filters": {
    "<columna>": "<valor o condición>"
  },
  "text_search": "<texto libre para buscar en título o doc number, o null>"
}

Para "Días Devolución" puedes usar: {">": 30} para mayor que, {"<": 10} para menor que, {">=": 15}, etc.
Para campos de texto, usa el valor tal cual (la búsqueda será case-insensitive y parcial).
Si el usuario dice "sin enviar" o "pendientes de envío", usa "Estado": "".
Si el usuario dice "pendientes de devolución", filtra por Estado "Enviado" y opcionalmente Días Devolución.
Omite filtros que no apliquen. Si no puedes interpretar la consulta, devuelve {"filters": {}, "text_search": "<query original>"}.
"""


class SearchQuery(BaseModel):
    query: str


def _apply_filters(data: list[dict], filters: dict, text_search: str | None) -> list[dict]:
    results = data

    for col, condition in filters.items():
        if isinstance(condition, dict):
            # Numeric comparison like {">": 30}
            for op, val in condition.items():
                val = float(val)
                if op == ">":
                    results = [r for r in results if _to_num(r.get(col)) is not None and _to_num(r.get(col)) > val]
                elif op == ">=":
                    results = [r for r in results if _to_num(r.get(col)) is not None and _to_num(r.get(col)) >= val]
                elif op == "<":
                    results = [r for r in results if _to_num(r.get(col)) is not None and _to_num(r.get(col)) < val]
                elif op == "<=":
                    results = [r for r in results if _to_num(r.get(col)) is not None and _to_num(r.get(col)) <= val]
                elif op == "==":
                    results = [r for r in results if _to_num(r.get(col)) is not None and _to_num(r.get(col)) == val]
        else:
            # String match (case-insensitive, partial)
            condition_str = str(condition).lower()
            if condition_str == "":
                results = [r for r in results if str(r.get(col, "")).strip() == ""]
            else:
                results = [r for r in results if condition_str in str(r.get(col, "")).lower()]

    if text_search:
        text_lower = text_search.lower()
        results = [
            r for r in results
            if text_lower in str(r.get("Título", "")).lower()
            or text_lower in str(r.get("Nº Doc. EIPSA", "")).lower()
            or text_lower in str(r.get("Nº Doc. Cliente", "")).lower()
        ]

    return results


def _to_num(val) -> float | None:
    try:
        v = float(val)
        return v
    except (TypeError, ValueError):
        return None


@router.post("/natural")
def natural_search(body: SearchQuery):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY no configurada")

    # Get monitoring data
    service = MonitoringService(data_repo, consulta_repo)
    all_data = service.get_monitoring_data()

    # Ask Claude to interpret the query
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": body.query}],
        )
        raw = response.content[0].text.strip()
        # Extract JSON from possible markdown code block
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: text search only
        parsed = {"filters": {}, "text_search": body.query}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar Claude: {e}")

    filters = parsed.get("filters", {})
    text_search = parsed.get("text_search")

    results = _apply_filters(all_data, filters, text_search)

    return {
        "query": body.query,
        "interpreted_filters": filters,
        "text_search": text_search,
        "count": len(results),
        "results": results[:200],  # Limit response size
    }
