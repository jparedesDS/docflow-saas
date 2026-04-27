import uuid
import os
from datetime import datetime, timezone

from utils.json_store import read_json, write_json

AGENDA_FILE = os.path.join(os.path.dirname(__file__), "..", "agenda_data.json")

_DEFAULT = {"notas": [], "reuniones": [], "tareas": []}

ESTADOS_PENDIENTES = {"sin enviar", "", "com. menores", "com. mayores", "comentado", "rechazado"}


def _load():
    data = read_json(AGENDA_FILE, default=_DEFAULT)
    if not isinstance(data, dict):
        return {k: list(v) for k, v in _DEFAULT.items()}
    return data


def _save(data):
    write_json(AGENDA_FILE, data)


def get_all(tipo: str):
    return _load().get(tipo, [])


def create(tipo: str, item: dict):
    data = _load()
    now = datetime.now(timezone.utc).isoformat()
    item["id"] = str(uuid.uuid4())
    item["createdAt"] = now
    item["updatedAt"] = now
    data[tipo].append(item)
    _save(data)
    return item


def update(tipo: str, item_id: str, changes: dict):
    data = _load()
    for i, it in enumerate(data[tipo]):
        if it["id"] == item_id:
            data[tipo][i] = {**it, **changes, "id": item_id, "updatedAt": datetime.now(timezone.utc).isoformat()}
            _save(data)
            return data[tipo][i]
    return None


DEFAULT_OWNER = "JP"


def _migrate_legacy_tasks():
    """Añade campo owner a tareas que no lo tienen (migración única desde sistema anterior)."""
    data = _load()
    changed = False
    for tarea in data["tareas"]:
        if "owner" not in tarea:
            asignado = tarea.get("asignado", "").strip()
            tarea["owner"] = asignado if asignado else DEFAULT_OWNER
            changed = True
    if changed:
        _save(data)
    return data


def get_tareas(owner: str):
    data = _migrate_legacy_tasks()
    return [t for t in data["tareas"] if t.get("owner") == owner]


def create_tarea(owner: str, item: dict):
    item["owner"] = owner
    return create("tareas", item)


def sync_tareas(owner: str, docs: list) -> dict:
    """Sync auto-generated tasks with current Excel state.

    - Creates tasks for NEW pending documents
    - Marks as completed tasks whose documents are no longer pending (e.g. approved/sent)
    - Updates description/status for documents that changed state but are still pending
    """
    data = _load()

    # Build lookup: source_doc_id → current Excel doc
    pending_by_source = {}
    for doc in docs:
        source_id = f"{doc.get('Nº Pedido', '')}_{doc.get('Nº Doc. EIPSA', '')}_{doc.get('Nº Revisión', doc.get('Rev.', ''))}"
        pending_by_source[source_id] = doc

    existing_source_ids = set()
    completed = 0
    updated = 0

    for tarea in data["tareas"]:
        if not tarea.get("auto_generated") or tarea.get("owner") != owner:
            continue
        sid = tarea.get("source_doc_id")
        if not sid:
            continue
        existing_source_ids.add(sid)

        if sid not in pending_by_source:
            # Document is no longer pending → mark task as completed
            if tarea["estado"] != "completada":
                tarea["estado"] = "completada"
                tarea["updatedAt"] = datetime.now(timezone.utc).isoformat()
                completed += 1
        else:
            # Document still pending → update description with current state
            doc = pending_by_source[sid]
            new_desc = f"Pedido {doc.get('Nº Pedido', '')} · Rev. {doc.get('Nº Revisión', '')} · Estado: {doc.get('Estado', '') or 'Sin Enviar'}"
            if tarea.get("descripcion") != new_desc:
                tarea["descripcion"] = new_desc
                tarea["updatedAt"] = datetime.now(timezone.utc).isoformat()
                updated += 1
            # Re-open if it was manually completed but doc is still pending
            if tarea["estado"] == "completada":
                tarea["estado"] = "pendiente"
                tarea["updatedAt"] = datetime.now(timezone.utc).isoformat()

    # Create new tasks for docs not yet tracked
    created = 0
    for source_id, doc in pending_by_source.items():
        if source_id in existing_source_ids:
            continue
        estado = (doc.get("Estado") or "").strip().lower()
        prioridad = "alta" if estado in {"rechazado", "com. mayores", "comentado"} else "media"
        if estado in {"sin enviar", ""} and str(doc.get("Crítico", "")).lower().strip() in ("sí", "si"):
            prioridad = "alta"
        titulo_raw = doc.get("Título") or doc.get("Material") or ""
        tarea = {
            "titulo": f"[{doc.get('Nº Doc. EIPSA', '')}] {titulo_raw[:60]}",
            "descripcion": f"Pedido {doc.get('Nº Pedido', '')} · Rev. {doc.get('Nº Revisión', '')} · Estado: {doc.get('Estado', '') or 'Sin Enviar'}",
            "prioridad": prioridad,
            "estado": "pendiente",
            "fecha_limite": str(doc.get("Fecha Prevista", "") or ""),
            "asignado": owner,
            "auto_generated": True,
            "source_doc_id": source_id,
            "owner": owner,
        }
        create("tareas", tarea)
        created += 1

    if completed > 0 or updated > 0:
        _save(data)

    return {"created": created, "completed": completed, "updated": updated}


def delete(tipo: str, item_id: str):
    data = _load()
    before = len(data[tipo])
    data[tipo] = [it for it in data[tipo] if it["id"] != item_id]
    if len(data[tipo]) < before:
        _save(data)
        return True
    return False
