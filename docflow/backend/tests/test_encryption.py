"""Tests for Fernet encryption utility."""

import os
import pytest
from unittest.mock import patch


def test_encrypt_decrypt_roundtrip():
    """Encrypted value should decrypt back to original."""
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()

    with patch.dict(os.environ, {"ENCRYPTION_KEY": key}):
        # Force re-init
        import utils.encryption as enc
        enc._fernet = None
        enc._FERNET_KEY = key

        result = enc.encrypt_value("my-secret-password")
        assert result != "my-secret-password"
        assert result.startswith("gAAAAA")
        assert enc.decrypt_value(result) == "my-secret-password"


def test_encrypt_without_key_returns_plaintext():
    """Without ENCRYPTION_KEY, values are stored in plaintext."""
    import utils.encryption as enc
    enc._fernet = None
    enc._FERNET_KEY = ""

    result = enc.encrypt_value("plain-password")
    assert result == "plain-password"


def test_decrypt_without_key_returns_as_is():
    """Without key, decrypt returns value unchanged."""
    import utils.encryption as enc
    enc._fernet = None
    enc._FERNET_KEY = ""

    assert enc.decrypt_value("some-value") == "some-value"


def test_decrypt_non_fernet_string_returns_as_is():
    """Non-Fernet strings pass through unchanged."""
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()

    import utils.encryption as enc
    enc._fernet = None
    enc._FERNET_KEY = key

    assert enc.decrypt_value("not-encrypted") == "not-encrypted"


def test_decrypt_invalid_fernet_token():
    """Invalid Fernet token (right prefix, wrong content) returns as-is."""
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()

    import utils.encryption as enc
    enc._fernet = None
    enc._FERNET_KEY = key

    result = enc.decrypt_value("gAAAAABinvalid-token-data")
    assert result == "gAAAAABinvalid-token-data"
