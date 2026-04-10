"""Tests for environment variable validation on startup."""

import os
import pytest
from unittest.mock import patch


class TestValidateRequiredEnv:
    """Tests for validate_required_env() in utils/config.py."""

    def _call(self):
        """Import and call validate_required_env with fresh module state."""
        from utils.config import validate_required_env
        validate_required_env()

    def test_passes_in_dev_mode_without_encryption_key(self):
        """In development, missing ENCRYPTION_KEY produces a warning but no error."""
        env = {
            "ENV": "development",
            "STORAGE_BACKEND": "excel",
            "JWT_SECRET": "test-secret",
            "SMTP_PASS": "smtp-pass",
        }
        with patch.dict(os.environ, env, clear=False):
            # Remove ENCRYPTION_KEY if present
            with patch.dict(os.environ, {"ENCRYPTION_KEY": ""}, clear=False):
                import utils.config as cfg
                old_env, old_sb = cfg.ENV, cfg.STORAGE_BACKEND
                cfg.ENV = "development"
                cfg.STORAGE_BACKEND = "excel"
                try:
                    self._call()  # Should not raise
                finally:
                    cfg.ENV, cfg.STORAGE_BACKEND = old_env, old_sb

    def test_raises_when_postgres_without_database_url(self):
        """STORAGE_BACKEND=postgres without DATABASE_URL should raise RuntimeError."""
        import utils.config as cfg
        old_env, old_sb = cfg.ENV, cfg.STORAGE_BACKEND
        cfg.ENV = "development"
        cfg.STORAGE_BACKEND = "postgres"
        try:
            with patch.dict(os.environ, {"DATABASE_URL": "", "ENCRYPTION_KEY": "x"}, clear=False):
                with pytest.raises(RuntimeError, match="DATABASE_URL is required"):
                    self._call()
        finally:
            cfg.ENV, cfg.STORAGE_BACKEND = old_env, old_sb

    def test_raises_when_production_without_encryption_key(self):
        """ENV=production without ENCRYPTION_KEY should raise RuntimeError."""
        import utils.config as cfg
        old_env, old_sb = cfg.ENV, cfg.STORAGE_BACKEND
        cfg.ENV = "production"
        cfg.STORAGE_BACKEND = "excel"
        try:
            with patch.dict(os.environ, {"ENCRYPTION_KEY": ""}, clear=False):
                with pytest.raises(RuntimeError, match="ENCRYPTION_KEY is required in production"):
                    self._call()
        finally:
            cfg.ENV, cfg.STORAGE_BACKEND = old_env, old_sb

    def test_passes_with_all_required_vars_set(self):
        """With all required vars set, validation should pass without error."""
        import utils.config as cfg
        old_env, old_sb = cfg.ENV, cfg.STORAGE_BACKEND
        cfg.ENV = "production"
        cfg.STORAGE_BACKEND = "postgres"
        try:
            env = {
                "DATABASE_URL": "postgresql://user:pass@localhost/db",
                "ENCRYPTION_KEY": "dGVzdC1rZXktMzItYnl0ZXMtcGFkZGVkISE=",
                "JWT_SECRET": "secure-production-secret",
                "SMTP_PASS": "smtp-pass",
            }
            with patch.dict(os.environ, env, clear=False):
                self._call()  # Should not raise
        finally:
            cfg.ENV, cfg.STORAGE_BACKEND = old_env, old_sb

    def test_multiple_issues_reported_together(self):
        """When multiple required vars are missing, all are reported in one error."""
        import utils.config as cfg
        old_env, old_sb = cfg.ENV, cfg.STORAGE_BACKEND
        cfg.ENV = "production"
        cfg.STORAGE_BACKEND = "postgres"
        try:
            with patch.dict(os.environ, {"DATABASE_URL": "", "ENCRYPTION_KEY": ""}, clear=False):
                with pytest.raises(RuntimeError) as exc_info:
                    self._call()
                error_msg = str(exc_info.value)
                assert "DATABASE_URL" in error_msg
                assert "ENCRYPTION_KEY" in error_msg
        finally:
            cfg.ENV, cfg.STORAGE_BACKEND = old_env, old_sb


class TestEncryptionProductionGuard:
    """Tests for production guard in encrypt_value()."""

    def test_encrypt_raises_in_production_without_key(self):
        """encrypt_value should raise RuntimeError in production without ENCRYPTION_KEY."""
        import utils.encryption as enc
        enc._fernet = None
        enc._FERNET_KEY = ""

        with patch.dict(os.environ, {"ENV": "production"}):
            with pytest.raises(RuntimeError, match="ENCRYPTION_KEY is required in production"):
                enc.encrypt_value("secret")

    def test_encrypt_returns_plaintext_in_dev_without_key(self):
        """encrypt_value should return plaintext in dev mode without ENCRYPTION_KEY."""
        import utils.encryption as enc
        enc._fernet = None
        enc._FERNET_KEY = ""

        with patch.dict(os.environ, {"ENV": "development"}):
            result = enc.encrypt_value("secret")
            assert result == "secret"
