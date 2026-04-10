import logging
import os
from dotenv import load_dotenv

load_dotenv()

_config_logger = logging.getLogger("docflow.config")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Rutas de archivos Excel
DATA_ERP_PATH = os.path.join(BASE_DIR, "data_erp.xlsx")
CONSULTA_ERP_PATH = os.path.join(BASE_DIR, "consulta_erp.xlsx")
TAGS_PATH = os.path.join(BASE_DIR, "data_tags.xlsx")

# Email (Resend - legacy)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")

# IMAP
IMAP_HOST = os.getenv("IMAP_HOST", "imap.soljem.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", "documentacion@eipsa.es")
IMAP_PASS = os.getenv("IMAP_PASS", "")

# SMTP
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.soljem.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "documentacion@eipsa.es")
SMTP_PASS = os.getenv("SMTP_PASS", "")

# Anthropic AI
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# DocuSign eSignature
DOCUSIGN_INTEGRATION_KEY = os.getenv("DOCUSIGN_INTEGRATION_KEY", "")
DOCUSIGN_USER_ID = os.getenv("DOCUSIGN_USER_ID", "")
DOCUSIGN_ACCOUNT_ID = os.getenv("DOCUSIGN_ACCOUNT_ID", "")
DOCUSIGN_BASE_URL = os.getenv("DOCUSIGN_BASE_URL", "https://demo.docusign.net")
DOCUSIGN_RSA_PRIVATE_KEY_PATH = os.getenv("DOCUSIGN_RSA_PRIVATE_KEY_PATH", "docusign_private.pem")

# CORS
_DEFAULT_CORS = "http://localhost:3000,http://localhost:8000,http://10.80.200.150:3000,http://10.80.200.150:8000"
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", _DEFAULT_CORS).split(",")
    if o.strip()
]

# Environment
ENV = os.getenv("ENV", "development")
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "excel")

# Backup destination (portable default)
BACKUP_DEST = os.getenv("BACKUP_DEST", os.path.join(BASE_DIR, "backups"))

# Cloud backup (S3-compatible)
BACKUP_S3_BUCKET = os.getenv("BACKUP_S3_BUCKET", "")
BACKUP_S3_PREFIX = os.getenv("BACKUP_S3_PREFIX", "docflow-backups/")
BACKUP_S3_ENDPOINT_URL = os.getenv("BACKUP_S3_ENDPOINT_URL", "")

# Base path for pedidos folders (optional, only for network-attached storage)
PEDIDOS_BASE_PATH = os.getenv("PEDIDOS_BASE_PATH", r"M:\base de datos de pedidos")

# API
API_VERSION = "v1"

# Equipo EIPSA — mapeo de iniciales → datos de usuario
USERS = {
    "JP":  {"nombre": "Jose Paredes",    "emails": ["documentacion@eipsa.es", "jose-paredes@eipsa.es"]},
    "AC":  {"nombre": "Ana Calvo",       "emails": ["ana-calvo@eipsa.es"]},
    "JM":  {"nombre": "Jesus Martinez",  "emails": ["jesus-martinez@eipsa.es"]},
    "EC":  {"nombre": "Ernesto Carrillo","emails": ["ernesto-carrillo@eipsa.es"]},
    "LB":  {"nombre": "Luis Bravo",      "emails": ["luis-bravo@eipsa.es"]},
    "SS":  {"nombre": "Santos Sanchez",  "emails": ["santos-sanchez@eipsa.es"]},
    "JV":  {"nombre": "Jorge Valtierra", "emails": ["jorge-valtierra@eipsa.es"]},
    "CCH": {"nombre": "Carlos Crespo",   "emails": ["carlos-crespohor@eipsa.es"]},
    "LM":  {"nombre": "Laura Minguez",   "emails": ["laura-minguez@eipsa.es"]},
    "DM":  {"nombre": "Daniel Marquez",    "emails": ["daniel-marquez@eipsa.es"]},
    "MS":  {"nombre": "Miguel Sahuquillo", "emails": ["miguel-sahuquillo@eipsa.es"]},
    "ES":  {"nombre": "Enrique Serrano",   "emails": ["enrique-serrano@eipsa.es"]},
    "JZ":  {"nombre": "Javier Zofio",      "emails": ["javier-zofio@eipsa.es"]},
    "JS":  {"nombre": "Jose A. Sanz",      "emails": ["josea-sanz@eipsa.es"]},
    "JUZ": {"nombre": "Julio Zofio",       "emails": ["julio-zofio@eipsa.es"]},
    "CZ":  {"nombre": "Carolina Zofio",    "emails": ["carolina-zofio@eipsa.es"]},
    "ALM": {"nombre": "Almacen",           "emails": ["almacen@eipsa.es"]},
    "MG":  {"nombre": "Mario Gil",         "emails": ["mario-gil@eipsa.es"]},
    "JUM": {"nombre": "Julian Martinez",   "emails": ["julian-martinez@eipsa.es"]},
    "RM":  {"nombre": "Rosa Martin",       "emails": ["rosa-martin@eipsa.es"]},
}


def validate_required_env():
    """Validate required environment variables on startup.

    Raises RuntimeError in production if critical vars are missing.
    Logs warnings in development.
    """
    issues = []

    # JWT_SECRET is already validated in auth_service.py for production
    # but we add a dev-mode warning here
    jwt_secret = os.getenv("JWT_SECRET", "docflow-dev-secret-change-me")
    if jwt_secret == "docflow-dev-secret-change-me" and ENV != "production":
        _config_logger.warning("JWT_SECRET using default dev value — set a secure value for production")

    # DATABASE_URL required when using PostgreSQL
    if STORAGE_BACKEND == "postgres":
        db_url = os.getenv("DATABASE_URL", "")
        if not db_url:
            issues.append("DATABASE_URL is required when STORAGE_BACKEND=postgres")

    # ENCRYPTION_KEY: required in production, warned in development
    encryption_key = os.getenv("ENCRYPTION_KEY", "")
    if not encryption_key:
        if ENV == "production":
            issues.append(
                "ENCRYPTION_KEY is required in production. "
                'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )
        else:
            _config_logger.warning(
                "ENCRYPTION_KEY not set — sensitive values will be stored in plaintext. "
                "This is acceptable for development only."
            )

    # SMTP_PASS: warn if email features will fail
    if not SMTP_PASS:
        _config_logger.warning("SMTP_PASS not set — email sending will fail")

    if issues:
        msg = "Missing required environment variables:\n" + "\n".join(f"  - {i}" for i in issues)
        raise RuntimeError(msg)

    _config_logger.info("Environment validation passed (env=%s, storage=%s)", ENV, STORAGE_BACKEND)
