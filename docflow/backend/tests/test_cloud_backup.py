"""Tests for cloud backup service."""

import os
import sys
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Ensure backend directory is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


class TestCloudBackupConfig:
    def test_not_configured_by_default(self):
        from services.cloud_backup_service import is_configured
        with patch.dict(os.environ, {"BACKUP_S3_BUCKET": ""}, clear=False):
            # Reimport to pick up env
            import services.cloud_backup_service as mod
            mod.S3_BUCKET = ""
            assert mod.is_configured() is False

    def test_configured_with_bucket(self):
        import services.cloud_backup_service as mod
        mod.S3_BUCKET = "my-bucket"
        assert mod.is_configured() is True
        mod.S3_BUCKET = ""  # Reset


class TestUploadBackup:
    def test_skip_when_not_configured(self):
        import services.cloud_backup_service as mod
        mod.S3_BUCKET = ""
        result = mod.upload_backup("/nonexistent/file.txt")
        assert result["status"] == "skipped"

    def test_error_when_file_not_found(self):
        import services.cloud_backup_service as mod
        mod.S3_BUCKET = "test-bucket"
        result = mod.upload_backup("/absolutely/nonexistent/file.txt")
        assert result["status"] == "error"
        mod.S3_BUCKET = ""

    def test_upload_success_with_mock(self, tmp_path):
        import services.cloud_backup_service as mod
        mod.S3_BUCKET = "test-bucket"

        # Create a temp file
        test_file = tmp_path / "test_backup.xlsx"
        test_file.write_text("test data")

        mock_client = MagicMock()
        with patch.object(mod, "_get_s3_client", return_value=mock_client):
            result = mod.upload_backup(str(test_file))

        assert result["status"] == "uploaded"
        assert "s3_key" in result
        mock_client.upload_file.assert_called_once()
        mod.S3_BUCKET = ""


class TestUploadDirectory:
    def test_upload_directory_with_files(self, tmp_path):
        import services.cloud_backup_service as mod
        mod.S3_BUCKET = "test-bucket"

        # Create temp files
        (tmp_path / "file1.xlsx").write_text("data1")
        (tmp_path / "file2.json").write_text("data2")

        mock_client = MagicMock()
        with patch.object(mod, "_get_s3_client", return_value=mock_client):
            result = mod.upload_directory(str(tmp_path))

        assert result["status"] == "completed"
        assert result["uploaded"] == 2
        mod.S3_BUCKET = ""

    def test_upload_directory_not_configured(self, tmp_path):
        import services.cloud_backup_service as mod
        mod.S3_BUCKET = ""
        result = mod.upload_directory(str(tmp_path))
        assert result["status"] == "skipped"

    def test_upload_directory_not_found(self):
        import services.cloud_backup_service as mod
        mod.S3_BUCKET = "test-bucket"
        result = mod.upload_directory("/nonexistent/directory")
        assert result["status"] == "error"
        mod.S3_BUCKET = ""
