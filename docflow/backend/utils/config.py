import os
from dotenv import load_dotenv

load_dotenv()

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
}
