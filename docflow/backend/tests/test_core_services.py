"""Core service unit tests — document, monitoring, notification, webhook, billing."""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock


class TestDocumentService:
    """DocumentService with ExcelRepository backend."""

    def test_list_all(self):
        from repositories.instances import data_repo
        from services.document_service import DocumentService
        svc = DocumentService(data_repo)
        result = svc.list_all()
        assert isinstance(result, list)

    def test_get_columns(self):
        from repositories.instances import data_repo
        from services.document_service import DocumentService
        svc = DocumentService(data_repo)
        cols = svc.get_columns()
        assert isinstance(cols, list)

    def test_get_by_id_nonexistent(self):
        from repositories.instances import data_repo
        from services.document_service import DocumentService
        svc = DocumentService(data_repo)
        result = svc.get_by_id("NONEXISTENT-99999")
        assert result is None

    def test_filter_by_estado(self):
        from repositories.instances import data_repo
        from services.document_service import DocumentService
        svc = DocumentService(data_repo)
        result = svc.filter_documents(estado="Aprobado")
        assert isinstance(result, list)

    def test_get_by_id_returns_dict_if_exists(self):
        from repositories.instances import data_repo
        from services.document_service import DocumentService
        svc = DocumentService(data_repo)
        all_docs = svc.list_all()
        if not all_docs:
            pytest.skip("No test data in Excel")
        df = data_repo._load()
        id_col = data_repo._get_id_column(df)
        first_id = str(all_docs[0].get(id_col, "")).strip()
        if not first_id:
            pytest.skip("First document has no ID")
        result = svc.get_by_id(first_id)
        assert result is not None
        assert isinstance(result, dict)


class TestMonitoringService:
    """MonitoringService with ExcelRepository backends."""

    def test_get_monitoring_data(self):
        from repositories.instances import data_repo, consulta_repo
        from services.monitoring_service import MonitoringService
        svc = MonitoringService(data_repo, consulta_repo)
        result = svc.get_monitoring_data()
        assert isinstance(result, list)

    def test_get_status_global(self):
        from repositories.instances import data_repo, consulta_repo
        from services.monitoring_service import MonitoringService
        svc = MonitoringService(data_repo, consulta_repo)
        result = svc.get_status_global()
        assert isinstance(result, list)

    def test_get_monitoring_columns(self):
        from repositories.instances import data_repo, consulta_repo
        from services.monitoring_service import MonitoringService
        svc = MonitoringService(data_repo, consulta_repo)
        result = svc.get_monitoring_columns()
        assert isinstance(result, list)

    def test_filter_monitoring(self):
        from repositories.instances import data_repo, consulta_repo
        from services.monitoring_service import MonitoringService
        svc = MonitoringService(data_repo, consulta_repo)
        result = svc.get_monitoring_data(estado="Aprobado")
        assert isinstance(result, list)


class TestNotificationService:
    """NotificationService — in-memory with json_store persistence."""

    def test_add_notification(self):
        from services.notification_service import NotificationService
        with patch("services.notification_service.read_json", return_value=[]), \
             patch("services.notification_service.write_json"):
            svc = NotificationService()
            entry = svc.add("test", "Test title", "Test detail")
            assert entry["tipo"] == "test"
            assert entry["titulo"] == "Test title"
            assert "timestamp" in entry

    def test_get_all_ordered(self):
        from services.notification_service import NotificationService
        with patch("services.notification_service.read_json", return_value=[]), \
             patch("services.notification_service.write_json"):
            svc = NotificationService()
            svc.add("a", "First")
            svc.add("b", "Second")
            items = svc.get_all()
            # get_all returns reversed (newest first)
            assert len(items) >= 2
            assert items[0]["titulo"] == "Second"

    def test_get_stats(self):
        from services.notification_service import NotificationService
        with patch("services.notification_service.read_json", return_value=[]), \
             patch("services.notification_service.write_json"):
            svc = NotificationService()
            svc.add("test", "Title")
            stats = svc.get_stats()
            assert "total" in stats
            assert "hoy" in stats
            assert "por_tipo" in stats
            assert stats["total"] >= 1

    def test_filter_by_tipo(self):
        from services.notification_service import NotificationService
        with patch("services.notification_service.read_json", return_value=[]), \
             patch("services.notification_service.write_json"):
            svc = NotificationService()
            svc.add("alpha", "A")
            svc.add("beta", "B")
            svc.add("alpha", "C")
            items = svc.get_all(tipo="alpha")
            assert all(i["tipo"] == "alpha" for i in items)
            assert len(items) == 2


class TestWebhookFormatters:
    """Webhook payload formatting — pure functions."""

    def test_format_slack(self):
        """Slack format produces blocks structure."""
        from services.webhook_service import format_slack_message
        payload = format_slack_message("document_updated", {"document_ref": "DOC-001"})
        assert isinstance(payload, dict)
        assert "blocks" in payload

    def test_format_teams(self):
        """Teams format produces card structure."""
        from services.webhook_service import format_teams_message
        payload = format_teams_message("document_updated", {"document_ref": "DOC-001"})
        assert isinstance(payload, dict)
        assert "type" in payload
        assert "attachments" in payload

    def test_format_generic(self):
        """Generic format wraps event and payload."""
        from services.webhook_service import format_generic_message
        payload = format_generic_message("document_updated", {"document_ref": "DOC-001"})
        assert isinstance(payload, dict)
        assert "event_type" in payload
        assert payload["event_type"] == "document_updated"
        assert "data" in payload
        assert "timestamp" in payload


class TestBillingIdempotency:
    """Billing webhook idempotency with Redis mock."""

    def test_duplicate_event_skipped(self):
        """If Redis says event already processed, skip."""
        from services.billing_service import handle_webhook

        mock_redis = MagicMock()
        mock_redis.get.return_value = b"processed"  # Already processed

        mock_stripe = MagicMock()
        mock_stripe.Webhook.construct_event.return_value = {
            "id": "evt_duplicate",
            "type": "checkout.session.completed",
            "data": {"object": {}},
        }

        with patch("services.billing_service._get_stripe", return_value=mock_stripe), \
             patch("utils.redis_client.get_redis", return_value=mock_redis):
            result = handle_webhook(b"payload", "sig_header")
            assert result is not None
            assert result.get("action") == "duplicate_skipped"

    def test_new_event_processed(self):
        """New event (not in Redis) with unknown type -> ignored."""
        from services.billing_service import handle_webhook

        mock_redis = MagicMock()
        mock_redis.get.return_value = None  # Not processed yet

        mock_stripe = MagicMock()
        mock_stripe.Webhook.construct_event.return_value = {
            "id": "evt_new_123",
            "type": "some.unknown.event",
            "data": {"object": {}},
        }

        with patch("services.billing_service._get_stripe", return_value=mock_stripe), \
             patch("utils.redis_client.get_redis", return_value=mock_redis):
            result = handle_webhook(b"payload", "sig_header")
            assert result is not None
            assert result.get("action") == "ignored"
            # Verify event was marked as processed in Redis
            mock_redis.setex.assert_called_once()
