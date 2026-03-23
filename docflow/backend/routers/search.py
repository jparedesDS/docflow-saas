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
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al consultar Claude")

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


@router.get("/faceted")
def faceted_search(
    q: str | None = None,
    estado: str | None = None,
    cliente: str | None = None,
    tipo: str | None = None,
    responsable: str | None = None,
    critico: str | None = None,
    limit: int = 200,
):
    """Faceted search with counts per facet value."""
    service = MonitoringService(data_repo, consulta_repo)
    all_data = service.get_monitoring_data()

    # Apply active filters
    filtered = all_data
    if q:
        q_lower = q.lower()
        filtered = [
            r for r in filtered
            if q_lower in str(r.get("Título", "")).lower()
            or q_lower in str(r.get("Nº Doc. EIPSA", "")).lower()
            or q_lower in str(r.get("Nº Doc. Cliente", "")).lower()
        ]
    if estado:
        estados = [s.strip() for s in estado.split(",")]
        filtered = [r for r in filtered if r.get("Estado", "") in estados]
    if cliente:
        clientes = [c.strip().lower() for c in cliente.split(",")]
        filtered = [r for r in filtered if str(r.get("Cliente", "")).lower() in clientes]
    if tipo:
        tipos = [t.strip().lower() for t in tipo.split(",")]
        filtered = [r for r in filtered if str(r.get("Tipo Doc.", "")).lower() in tipos]
    if responsable:
        resps = [rr.strip() for rr in responsable.split(",")]
        filtered = [r for r in filtered if r.get("Repsonsable", "") in resps]
    if critico:
        filtered = [r for r in filtered if str(r.get("Crítico", "")).lower() == critico.lower()]

    # Compute facets from filtered data
    facets = {
        "Estado": {},
        "Cliente": {},
        "Tipo Doc.": {},
        "Repsonsable": {},
        "Crítico": {},
    }
    for row in filtered:
        for facet_key in facets:
            val = str(row.get(facet_key, "")).strip()
            if not val:
                val = "(vacío)" if facet_key == "Estado" else ""
            if val:
                facets[facet_key][val] = facets[facet_key].get(val, 0) + 1

    # Sort facet values by count descending
    for key in facets:
        facets[key] = dict(sorted(facets[key].items(), key=lambda x: -x[1]))

    return {
        "count": len(filtered),
        "facets": facets,
        "results": filtered[:limit],
    }
