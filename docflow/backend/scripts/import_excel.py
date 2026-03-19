"""Import Excel data + JSON state into PostgreSQL with tenant_id=1 (EIPSA).

Usage:
    cd docflow/backend
    python scripts/import_excel.py

Reads from:
    - data_erp.xlsx, consulta_erp.xlsx, data_tags.xlsx
    - users.json, claims_log.json, agenda_data.json
    - notifications_log.json, email_templates.json, scheduled_reports.json
    - processed_emails.json
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from db.database import SessionLocal, engine, Base
from db.models import (
    Tenant, User, Document, Consulta, TagInspection,
    AgendaItem, ClaimLog, Notification, EmailTemplateDB,
    ScheduledReportDB, ProcessedEmail, BillingInfo,
)
from services.auth_service import hash_password

TENANT_ID = 1
BACKEND_DIR = Path(__file__).resolve().parent.parent
BASE_DIR = BACKEND_DIR.parent.parent


def _read_json(path: Path, default=None):
    if not path.exists():
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _convert_value(val):
    """Convert pandas/numpy values to JSON-serializable Python types."""
    if pd.isna(val):
        return ""
    if hasattr(val, "isoformat"):
        return val.isoformat()
    if hasattr(val, "item"):  # numpy scalar
        return val.item()
    return val


def import_excel(session, file_path: Path, model_class, label: str, skiprows=None):
    if not file_path.exists():
        print(f"  SKIP {label}: {file_path} not found")
        return 0

    df = pd.read_excel(file_path, engine="openpyxl", skiprows=skiprows)
    count = 0
    for _, row in df.iterrows():
        data = {col: _convert_value(row[col]) for col in df.columns}
        obj = model_class(tenant_id=TENANT_ID, data=data)
        session.add(obj)
        count += 1

    session.flush()
    print(f"  OK {label}: {count} rows imported")
    return count


def import_users(session):
    users_file = BACKEND_DIR / "users.json"
    if not users_file.exists():
        print("  SKIP users: users.json not found")
        return 0

    users = _read_json(users_file, {})
    count = 0
    for username, udata in users.items():
        user = User(
            tenant_id=TENANT_ID,
            username=username,
            name=udata.get("name", username),
            initials=udata.get("initials", username[:2].upper()),
            role=udata.get("role", ""),
            password_hash=udata.get("password_hash", hash_password("Aa123456")),
            is_active=True,
        )
        session.add(user)
        count += 1

    session.flush()
    print(f"  OK users: {count} imported")
    return count


def import_claims(session):
    path = BACKEND_DIR / "claims_log.json"
    data = _read_json(path, {})
    count = 0
    for pedido, entry in data.items():
        last_claimed = entry.get("last_claimed")
        if last_claimed:
            try:
                last_claimed = datetime.fromisoformat(last_claimed)
            except (ValueError, TypeError):
                last_claimed = None

        history = entry.get("history", [])
        # Migrate old format
        if not history and "sent_at" in entry:
            history = [{
                "sent_at": entry["sent_at"],
                "to": entry.get("to", []),
                "cc": entry.get("cc", []),
                "docs_count": entry.get("docs_count", 0),
            }]

        obj = ClaimLog(
            tenant_id=TENANT_ID,
            pedido=pedido,
            last_claimed=last_claimed,
            history=history,
        )
        session.add(obj)
        count += 1

    session.flush()
    print(f"  OK claims: {count} imported")
    return count


def import_agenda(session):
    path = BACKEND_DIR / "agenda_data.json"
    data = _read_json(path, {"notas": [], "reuniones": [], "tareas": []})
    count = 0
    for tipo in ["notas", "reuniones", "tareas"]:
        for item in data.get(tipo, []):
            item_id = item.get("id", str(count))
            obj = AgendaItem(
                id=item_id,
                tenant_id=TENANT_ID,
                tipo=tipo,
                data=item,
                owner=item.get("owner"),
                source_doc_id=item.get("source_doc_id"),
            )
            session.add(obj)
            count += 1

    session.flush()
    print(f"  OK agenda: {count} items imported")
    return count


def import_notifications(session):
    path = BACKEND_DIR / "notifications_log.json"
    items = _read_json(path, [])
    count = 0
    for item in items[-500:]:
        obj = Notification(
            tenant_id=TENANT_ID,
            tipo=item.get("tipo", ""),
            titulo=item.get("titulo", ""),
            detalle=item.get("detalle", ""),
            metadata_=item.get("metadata", {}),
        )
        session.add(obj)
        count += 1

    session.flush()
    print(f"  OK notifications: {count} imported")
    return count


def import_templates(session):
    path = BACKEND_DIR / "email_templates.json"
    items = _read_json(path, [])
    count = 0
    for item in items:
        obj = EmailTemplateDB(
            tenant_id=TENANT_ID,
            template_id=item.get("id", ""),
            nombre=item.get("nombre", ""),
            asunto=item.get("asunto", ""),
            cuerpo_html=item.get("cuerpo_html", ""),
            variables=item.get("variables", []),
            tipo=item.get("tipo", ""),
        )
        session.add(obj)
        count += 1

    session.flush()
    print(f"  OK templates: {count} imported")
    return count


def import_scheduled_reports(session):
    path = BACKEND_DIR / "scheduled_reports.json"
    items = _read_json(path, [])
    count = 0
    for item in items:
        obj = ScheduledReportDB(
            tenant_id=TENANT_ID,
            report_id=item.get("id", ""),
            type=item.get("type", ""),
            title=item.get("title", ""),
            description=item.get("description", ""),
            enabled=item.get("enabled", True),
            frequency=item.get("frequency", "weekly"),
            schedule=item.get("schedule", {}),
            recipients=item.get("recipients", {"to": [], "cc": []}),
            options=item.get("options", {}),
            last_run=item.get("last_run"),
        )
        session.add(obj)
        count += 1

    session.flush()
    print(f"  OK scheduled_reports: {count} imported")
    return count


def import_processed_emails(session):
    path = BACKEND_DIR / "processed_emails.json"
    uids = _read_json(path, [])
    count = 0
    for uid in uids:
        obj = ProcessedEmail(
            tenant_id=TENANT_ID,
            uid=str(uid),
        )
        session.add(obj)
        count += 1

    session.flush()
    print(f"  OK processed_emails: {count} imported")
    return count


def main():
    print("DocFlow Excel→PostgreSQL Import")
    print(f"  DATABASE_URL: {os.getenv('DATABASE_URL', '(default)')}")
    print(f"  TENANT_ID: {TENANT_ID}")
    print()

    session = SessionLocal()
    try:
        # Ensure EIPSA tenant exists
        tenant = session.query(Tenant).filter(Tenant.id == TENANT_ID).first()
        if not tenant:
            tenant = Tenant(id=TENANT_ID, name="EIPSA", slug="eipsa", plan="enterprise", max_users=25)
            session.add(tenant)
            session.flush()
            print("  Created EIPSA tenant (id=1)")

        # Create billing info for EIPSA
        billing = session.query(BillingInfo).filter(BillingInfo.tenant_id == TENANT_ID).first()
        if not billing:
            billing = BillingInfo(tenant_id=TENANT_ID, plan="enterprise", status="active")
            session.add(billing)
            session.flush()

        print("\n--- Excel files ---")
        import_excel(session, BASE_DIR / "data_erp.xlsx", Document, "documents")
        import_excel(session, BASE_DIR / "consulta_erp.xlsx", Consulta, "consultas")
        import_excel(session, BASE_DIR / "data_tags.xlsx", TagInspection, "tags", skiprows=[1])

        print("\n--- JSON state ---")
        import_users(session)
        import_claims(session)
        import_agenda(session)
        import_notifications(session)
        import_templates(session)
        import_scheduled_reports(session)
        import_processed_emails(session)

        session.commit()
        print("\nImport completed successfully!")

    except Exception as e:
        session.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
