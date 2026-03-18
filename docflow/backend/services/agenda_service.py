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
    """Crea tareas automáticas para docs pendientes del owner. Evita duplicados."""
    data = _load()
    existing_source_ids = {t["source_doc_id"] for t in data["tareas"] if t.get("source_doc_id")}
    created = 0
    skipped = 0
    for doc in docs:
        source_id = f"{doc.get('Nº Pedido', '')}_{doc.get('Nº Doc. EIPSA', '')}_{doc.get('Nº Revisión', doc.get('Rev.', ''))}"
        if source_id in existing_source_ids:
            skipped += 1
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
        existing_source_ids.add(source_id)
        created += 1
    return {"created": created, "skipped": skipped}


def delete(tipo: str, item_id: str):
    data = _load()
    before = len(data[tipo])
    data[tipo] = [it for it in data[tipo] if it["id"] != item_id]
    if len(data[tipo]) < before:
        _save(data)
        return True
    return False
