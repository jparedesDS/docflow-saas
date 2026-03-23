"""Fernet encryption for sensitive values (IMAP passwords, tenant settings)."""

import logging
import os

logger = logging.getLogger(__name__)

_FERNET_KEY = os.getenv("ENCRYPTION_KEY", "")
_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet
    if not _FERNET_KEY:
        return None
    try:
        from cryptography.fernet import Fernet
        _fernet = Fernet(_FERNET_KEY.encode() if isinstance(_FERNET_KEY, str) else _FERNET_KEY)
        return _fernet
    except Exception as e:
        logger.warning("Failed to initialize Fernet: %s", e)
        return None


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string. Returns ciphertext or plaintext if no key."""
    f = _get_fernet()
    if f is None:
        logger.warning("ENCRYPTION_KEY not set — storing value in plaintext")
        return plaintext
    return f.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a ciphertext string. Returns plaintext or ciphertext as-is if not encrypted."""
    f = _get_fernet()
    if f is None:
        return ciphertext
    # Fernet tokens start with 'gAAAAA'
    if not ciphertext.startswith("gAAAAA"):
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        logger.warning("Failed to decrypt value — returning as-is")
        return ciphertext
