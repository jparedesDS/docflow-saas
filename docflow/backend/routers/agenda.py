from fastapi import APIRouter, HTTPException, Query
from typing import Any
from services import agenda_service
from services.monitoring_service import MonitoringService
from services.reunion_sync_service import fetch_reuniones_from_email
from repositories.instances import data_repo, consulta_repo

router = APIRouter()

TIPOS = {"notas", "reuniones", "tareas"}

_monitoring_service = MonitoringService(data_repo, consulta_repo)


def _check(tipo):
    if tipo not in TIPOS:
        raise HTTPException(status_code=400, detail=f"Tipo inválido: {tipo}")


@router.get("/notas")
def get_notas():
    return agenda_service.get_all("notas")

@router.post("/notas")
def create_nota(item: dict):
    return agenda_service.create("notas", item)

@router.put("/notas/{item_id}")
def update_nota(item_id: str, item: dict):
    result = agenda_service.update("notas", item_id, item)
    if result is None:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return result

@router.delete("/notas/{item_id}")
def delete_nota(item_id: str):
    if not agenda_service.delete("notas", item_id):
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    return {"ok": True}


@router.get("/reuniones")
def get_reuniones(owner: str = Query(None)):
    stored = agenda_service.get_all("reuniones")
    if not owner:
        return stored

    # Sync desde email del owner
    from_email = fetch_reuniones_from_email(owner)

    # Deduplicar contra las ya almacenadas (por _uid o titulo+fecha)
    existing_keys = set()
    for r in stored:
        key = r.get("_uid") or f"{r.get('titulo','')}_{r.get('fecha','')}"
        existing_keys.add(key)

    new_reuniones = []
    for r in from_email:
        key = r.get("_uid") or f"{r.get('titulo','')}_{r.get('fecha','')}"
        if key not in existing_keys:
            saved = agenda_service.create("reuniones", r)
            new_reuniones.append(saved)
            existing_keys.add(key)

    return agenda_service.get_all("reuniones")

@router.post("/reuniones")
def create_reunion(item: dict):
    return agenda_service.create("reuniones", item)

@router.put("/reuniones/{item_id}")
def update_reunion(item_id: str, item: dict):
    result = agenda_service.update("reuniones", item_id, item)
    if result is None:
        raise HTTPException(status_code=404, detail="Reunión no encontrada")
    return result

@router.delete("/reuniones/{item_id}")
def delete_reunion(item_id: str):
    if not agenda_service.delete("reuniones", item_id):
        raise HTTPException(status_code=404, detail="Reunión no encontrada")
    return {"ok": True}


@router.get("/tareas")
def get_tareas(owner: str = Query(...)):
    return agenda_service.get_tareas(owner)

@router.post("/tareas/sync")
def sync_tareas(owner: str = Query(...)):
    all_docs = _monitoring_service.get_monitoring_data()
    pending = [
        d for d in all_docs
        if str(d.get("Repsonsable", "") or "").strip() == owner
        and (d.get("Estado", "") or "").strip().lower() in agenda_service.ESTADOS_PENDIENTES
    ]
    return agenda_service.sync_tareas(owner, pending)


@router.get("/reuniones/debug")
def reuniones_debug(owner: str = Query(...)):
    """Diagnóstico: qué encuentra el IMAP del owner buscando invitaciones."""
    from services.reunion_sync_service import USER_IMAP_CREDS, IMAP_HOST, IMAP_PORT
    import imaplib, email as emaillib

    creds = USER_IMAP_CREDS.get(owner)
    if not creds:
        return {"error": f"Sin credenciales para owner '{owner}'"}
    if not creds["pass"]:
        return {"error": "Contraseña vacía en .env"}

    result = {"owner": owner, "user": creds["user"], "host": IMAP_HOST, "port": IMAP_PORT}

    try:
        with imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT) as imap:
            imap.login(creds["user"], creds["pass"])
            result["login"] = "OK"

            imap.select("INBOX")
            _, total = imap.search(None, "ALL")
            result["total_inbox"] = len(total[0].split()) if total[0] else 0

            # Buscar por distintos criterios
            searches = {
                "SUBJECT invitation": 'SUBJECT "invitation"',
                "SUBJECT reunión":    'SUBJECT "reuni"',
                "SUBJECT meeting":    'SUBJECT "meeting"',
                "ALL (últimos 20)":   "ALL",
            }
            result["searches"] = {}
            for label, criteria in searches.items():
                _, nums = imap.search(None, criteria)
                ids = nums[0].split() if nums[0] else []
                result["searches"][label] = len(ids)

            # Inspeccionar los últimos 20 emails: Content-Type y asunto
            _, all_ids = imap.search(None, "ALL")
            last_20 = (all_ids[0].split() or [])[-20:]
            samples = []
            for num in reversed(last_20):
                _, data = imap.fetch(num, "(BODY.PEEK[HEADER.FIELDS (SUBJECT CONTENT-TYPE)])")
                if data and data[0]:
                    raw = data[0][1].decode("utf-8", errors="replace")
                    samples.append(raw.strip().replace("\r\n", " | "))
            result["ultimos_20_headers"] = samples

            # Buscar emails con REUNI en asunto y mostrar cuerpo completo
            _, reuni_ids = imap.search(None, 'SUBJECT "reuni"')
            reuni_samples = []
            for num in (reuni_ids[0].split() if reuni_ids[0] else [])[:3]:
                _, data = imap.fetch(num, "(RFC822)")
                raw = data[0][1] if data and data[0] else None
                if raw:
                    msg = emaillib.message_from_bytes(raw)
                    subject = str(emaillib.header.decode_header(msg.get("Subject",""))[0][0])
                    date = msg.get("Date","")
                    body = ""
                    for part in msg.walk():
                        ct = part.get_content_type()
                        if ct == "text/plain":
                            body = part.get_payload(decode=True).decode("utf-8", errors="replace")[:600]
                            break
                        elif ct == "text/html" and not body:
                            body = part.get_payload(decode=True).decode("utf-8", errors="replace")[:600]
                    reuni_samples.append({"subject": subject, "date": date, "body_preview": body})
            result["reunion_emails"] = reuni_samples

    except imaplib.IMAP4.error as e:
        result["error"] = f"IMAP error: {e}"
    except Exception as e:
        result["error"] = f"Error: {e}"

    return result


@router.get("/tareas/sync/debug")
def sync_debug(owner: str = Query(...)):
    """Devuelve info de diagnóstico: columnas disponibles y muestra de valores de Responsable/Estado."""
    all_docs = _monitoring_service.get_monitoring_data()
    if not all_docs:
        return {"error": "Sin documentos", "total": 0}

    responsables = list({str(d.get("Responsable", "") or "").strip() for d in all_docs})
    repsonsables = list({str(d.get("Repsonsable", "") or "").strip() for d in all_docs})
    estados = list({str(d.get("Estado", "") or "").strip().lower() for d in all_docs})

    pending = [
        d for d in all_docs
        if str(d.get("Repsonsable", "") or "").strip() == owner
        and (d.get("Estado", "") or "").strip().lower() in agenda_service.ESTADOS_PENDIENTES
    ]

    return {
        "total_docs": len(all_docs),
        "columnas": list(all_docs[0].keys()) if all_docs else [],
        "Responsable_unicos (comercial)": sorted(responsables)[:30],
        "Repsonsable_unicos (doc handler)": sorted(repsonsables)[:30],
        "estados_unicos": sorted(estados),
        "estados_pendientes_buscados": sorted(agenda_service.ESTADOS_PENDIENTES),
        "docs_para_owner": len([d for d in all_docs if str(d.get("Repsonsable", "") or "").strip() == owner]),
        "docs_pendientes_para_owner": len(pending),
        "muestra_pendientes": pending[:3],
    }

@router.post("/tareas")
def create_tarea(item: dict, owner: str = Query(...)):
    return agenda_service.create_tarea(owner, item)

@router.put("/tareas/{item_id}")
def update_tarea(item_id: str, item: dict):
    result = agenda_service.update("tareas", item_id, item)
    if result is None:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return result

@router.delete("/tareas/{item_id}")
def delete_tarea(item_id: str):
    if not agenda_service.delete("tareas", item_id):
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return {"ok": True}
