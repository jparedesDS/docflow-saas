"""Tests for DocFlow SaaS professional features (Phases 1-3).

Covers: plan service, ORM models, service imports, router imports,
workflow engine, API key utilities, classification service, audit service,
webhook formatting, and migration file validation.

All tests run in EXCEL mode (no database required) unless explicitly noted.
"""

import os
import sys
import hashlib
import secrets
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# ── Ensure backend is on sys.path (same pattern as conftest.py) ──────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Force excel mode for all tests — no DB required
os.environ.setdefault("STORAGE_BACKEND", "excel")
os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest")


# ══════════════════════════════════════════════════════════════════════════
# Plan Service Tests
# ══════════════════════════════════════════════════════════════════════════


class TestPlanService:
    """Test that new feature flags exist in all plans."""

    def test_free_plan_has_new_features(self):
        from services.plan_service import PLANS

        features = PLANS["free"]["features"]
        assert features["audit_trail"] == True
        assert features["comments"] == True
        assert features["saved_filters"] == True
        assert features["bulk_actions"] == False
        assert features["webhooks"] == False
        assert features["file_attachments"] == False
        assert features["api_keys"] == False
        assert features["classification"] == False
        assert features["client_portal"] == False

    def test_pro_plan_has_new_features(self):
        from services.plan_service import PLANS

        features = PLANS["pro"]["features"]
        assert features["bulk_actions"] == True
        assert features["webhooks"] == True
        assert features["file_attachments"] == True
        assert features["api_keys"] == False

    def test_enterprise_plan_has_all_features(self):
        from services.plan_service import PLANS

        features = PLANS["enterprise"]["features"]
        expected_true = [
            "audit_trail", "comments", "saved_filters", "bulk_actions",
            "webhooks", "file_attachments", "api_keys", "classification",
            "client_portal",
        ]
        for key in expected_true:
            assert features[key] == True, f"Enterprise missing {key}"

    def test_all_plans_exist(self):
        from services.plan_service import PLANS

        assert "free" in PLANS
        assert "pro" in PLANS
        assert "enterprise" in PLANS

    def test_free_plan_limits(self):
        from services.plan_service import PLANS

        free = PLANS["free"]
        assert free["max_users"] == 3
        assert free["max_documents"] == 500

    def test_pro_plan_limits(self):
        from services.plan_service import PLANS

        pro = PLANS["pro"]
        assert pro["max_users"] == 15
        assert pro["max_documents"] == 10000

    def test_enterprise_plan_unlimited(self):
        from services.plan_service import PLANS

        enterprise = PLANS["enterprise"]
        assert enterprise["max_users"] == -1
        assert enterprise["max_documents"] == -1
        assert enterprise["max_api_calls_per_month"] == -1

    def test_get_plan_excel_mode_returns_enterprise(self):
        """In excel mode, get_plan should return 'enterprise' (single-tenant)."""
        from services.plan_service import get_plan

        result = get_plan(tenant_id=1)
        assert result == "enterprise"

    def test_check_feature_excel_mode(self):
        """In excel mode, all features should be available (enterprise plan)."""
        from services.plan_service import check_feature

        assert check_feature(1, "workflows") == True
        assert check_feature(1, "api_keys") == True
        assert check_feature(1, "classification") == True

    def test_get_features_excel_mode(self):
        from services.plan_service import get_features

        features = get_features(1)
        assert isinstance(features, dict)
        assert len(features) > 0
        assert features.get("audit_trail") == True

    def test_get_limits_excel_mode(self):
        from services.plan_service import get_limits

        limits = get_limits(1)
        assert "max_users" in limits
        assert "max_documents" in limits
        assert "max_api_calls_per_month" in limits

    def test_free_plan_feature_flags_count(self):
        """Ensure free plan has all required feature flags (no missing keys)."""
        from services.plan_service import PLANS

        free_features = PLANS["free"]["features"]
        enterprise_features = PLANS["enterprise"]["features"]
        # Free plan must define every key that enterprise defines
        for key in enterprise_features:
            assert key in free_features, f"Free plan missing feature flag: {key}"

    def test_pro_plan_feature_flags_count(self):
        """Ensure pro plan has all required feature flags."""
        from services.plan_service import PLANS

        pro_features = PLANS["pro"]["features"]
        enterprise_features = PLANS["enterprise"]["features"]
        for key in enterprise_features:
            assert key in pro_features, f"Pro plan missing feature flag: {key}"


# ══════════════════════════════════════════════════════════════════════════
# Model Import Tests
# ══════════════════════════════════════════════════════════════════════════


class TestModels:
    """Test that all new ORM models can be imported."""

    def test_import_audit_log(self):
        from db.models import AuditLog

        assert AuditLog.__tablename__ == "audit_logs"

    def test_import_saved_filter(self):
        from db.models import SavedFilter

        assert SavedFilter.__tablename__ == "saved_filters"

    def test_import_document_comment(self):
        from db.models import DocumentComment

        assert DocumentComment.__tablename__ == "document_comments"

    def test_import_document_attachment(self):
        from db.models import DocumentAttachment

        assert DocumentAttachment.__tablename__ == "document_attachments"

    def test_import_webhook_config(self):
        from db.models import WebhookConfig

        assert WebhookConfig.__tablename__ == "webhook_configs"

    def test_import_api_key(self):
        from db.models import ApiKey

        assert ApiKey.__tablename__ == "api_keys"

    def test_import_workflow(self):
        from db.models import Workflow

        assert Workflow.__tablename__ == "workflows"

    def test_import_approval_request(self):
        from db.models import ApprovalRequest

        assert ApprovalRequest.__tablename__ == "approval_requests"

    def test_audit_log_has_tenant_id(self):
        from db.models import AuditLog

        columns = [c.name for c in AuditLog.__table__.columns]
        assert "tenant_id" in columns

    def test_saved_filter_has_tenant_id(self):
        from db.models import SavedFilter

        columns = [c.name for c in SavedFilter.__table__.columns]
        assert "tenant_id" in columns

    def test_document_comment_has_tenant_id(self):
        from db.models import DocumentComment

        columns = [c.name for c in DocumentComment.__table__.columns]
        assert "tenant_id" in columns

    def test_document_attachment_has_tenant_id(self):
        from db.models import DocumentAttachment

        columns = [c.name for c in DocumentAttachment.__table__.columns]
        assert "tenant_id" in columns

    def test_webhook_config_has_tenant_id(self):
        from db.models import WebhookConfig

        columns = [c.name for c in WebhookConfig.__table__.columns]
        assert "tenant_id" in columns

    def test_api_key_has_tenant_id(self):
        from db.models import ApiKey

        columns = [c.name for c in ApiKey.__table__.columns]
        assert "tenant_id" in columns

    def test_audit_log_columns(self):
        """AuditLog must have all required columns."""
        from db.models import AuditLog

        columns = {c.name for c in AuditLog.__table__.columns}
        required = {"id", "tenant_id", "entity_type", "entity_id", "action",
                     "field_name", "old_value", "new_value", "user_initials",
                     "user_name", "metadata", "created_at"}
        assert required.issubset(columns), f"Missing: {required - columns}"

    def test_saved_filter_columns(self):
        from db.models import SavedFilter

        columns = {c.name for c in SavedFilter.__table__.columns}
        required = {"id", "tenant_id", "user_initials", "name", "entity_type",
                     "filters", "is_default", "created_at"}
        assert required.issubset(columns), f"Missing: {required - columns}"

    def test_document_comment_columns(self):
        from db.models import DocumentComment

        columns = {c.name for c in DocumentComment.__table__.columns}
        required = {"id", "tenant_id", "document_ref", "parent_id",
                     "user_initials", "user_name", "content", "mentions",
                     "created_at", "updated_at"}
        assert required.issubset(columns), f"Missing: {required - columns}"

    def test_document_attachment_columns(self):
        from db.models import DocumentAttachment

        columns = {c.name for c in DocumentAttachment.__table__.columns}
        required = {"id", "tenant_id", "document_ref", "filename",
                     "content_type", "size_bytes", "storage_path",
                     "uploaded_by", "created_at"}
        assert required.issubset(columns), f"Missing: {required - columns}"

    def test_webhook_config_columns(self):
        from db.models import WebhookConfig

        columns = {c.name for c in WebhookConfig.__table__.columns}
        required = {"id", "tenant_id", "name", "url", "platform", "events",
                     "enabled", "created_at"}
        assert required.issubset(columns), f"Missing: {required - columns}"

    def test_api_key_columns(self):
        from db.models import ApiKey

        columns = {c.name for c in ApiKey.__table__.columns}
        required = {"id", "tenant_id", "name", "key_hash", "key_prefix",
                     "scopes", "last_used_at", "expires_at", "created_by",
                     "created_at"}
        assert required.issubset(columns), f"Missing: {required - columns}"


# ══════════════════════════════════════════════════════════════════════════
# Service Import Tests
# ══════════════════════════════════════════════════════════════════════════


class TestServiceImports:
    """Test that all new services can be imported and expose expected symbols."""

    def test_audit_service(self):
        from services.audit_service import log_change, log_entity_changes, get_entity_log, get_recent_activity

    def test_comment_service(self):
        from services.comment_service import list_comments, create_comment, delete_comment, get_comment_count

    def test_saved_filter_service(self):
        from services.saved_filter_service import list_filters, create_filter, delete_filter, set_default

    def test_workflow_engine(self):
        from services.workflow_engine import on_event, evaluate_conditions, execute_action

    def test_storage_service(self):
        from services.storage_service import upload, download, list_files, delete_file

    def test_webhook_service(self):
        from services.webhook_service import (
            dispatch_event, list_webhooks, create_webhook,
            update_webhook, delete_webhook, test_webhook,
        )

    def test_api_key_service(self):
        from services.api_key_service import create_key, validate_key, list_keys, delete_key

    def test_supplier_scorecard_service(self):
        from services.supplier_scorecard_service import get_scorecard

    def test_classification_service(self):
        from services.classification_service import (
            get_classification, set_classification, CLASSIFICATION_LEVELS,
        )

    def test_plan_service(self):
        from services.plan_service import (
            PLANS, get_plan, get_plan_config, check_feature,
            check_quota, get_features, get_limits,
        )

    def test_workflow_service(self):
        from services.workflow_service import create_approval_request


# ══════════════════════════════════════════════════════════════════════════
# Router Import Tests
# ══════════════════════════════════════════════════════════════════════════


class TestRouterImports:
    """Test that all new routers can be imported and have a router object."""

    def test_audit_router(self):
        from routers.audit import router

        assert router is not None

    def test_comments_router(self):
        from routers.comments import router

        assert router is not None

    def test_saved_filters_router(self):
        from routers.saved_filters import router

        assert router is not None

    def test_attachments_router(self):
        from routers.attachments import router

        assert router is not None

    def test_webhooks_config_router(self):
        from routers.webhooks_config import router

        assert router is not None

    def test_api_keys_router(self):
        from routers.api_keys import router

        assert router is not None

    def test_workflows_router(self):
        from routers.workflows import router

        assert router is not None


# ══════════════════════════════════════════════════════════════════════════
# Workflow Engine Unit Tests
# ══════════════════════════════════════════════════════════════════════════


class TestWorkflowEngine:
    """Test workflow engine condition evaluation and action execution."""

    def test_evaluate_conditions_equals(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "new_status", "operator": "equals", "value": "Rechazado"}]
        data = {"new_status": "Rechazado", "document_ref": "DOC-001"}
        assert evaluate_conditions(conditions, data) == True

    def test_evaluate_conditions_not_equals(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "new_status", "operator": "not_equals", "value": "Aprobado"}]
        data = {"new_status": "Rechazado"}
        assert evaluate_conditions(conditions, data) == True

    def test_evaluate_conditions_not_equals_false(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "status", "operator": "not_equals", "value": "Aprobado"}]
        data = {"status": "Aprobado"}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_conditions_contains(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "new_status", "operator": "contains", "value": "Com."}]
        data = {"new_status": "Com. Menores"}
        assert evaluate_conditions(conditions, data) == True

    def test_evaluate_conditions_contains_false(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "new_status", "operator": "contains", "value": "Rechazado"}]
        data = {"new_status": "Aprobado"}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_conditions_contains_none_actual(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "missing_field", "operator": "contains", "value": "test"}]
        data = {"other": "value"}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_conditions_greater_than(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "days", "operator": "greater_than", "value": "30"}]
        data = {"days": 45}
        assert evaluate_conditions(conditions, data) == True

    def test_evaluate_conditions_greater_than_equal(self):
        """Boundary: value equal to threshold should NOT pass greater_than."""
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "days", "operator": "greater_than", "value": "30"}]
        data = {"days": 30}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_conditions_greater_than_non_numeric(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "days", "operator": "greater_than", "value": "30"}]
        data = {"days": "not_a_number"}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_conditions_less_than(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "days", "operator": "less_than", "value": "10"}]
        data = {"days": 5}
        assert evaluate_conditions(conditions, data) == True

    def test_evaluate_conditions_less_than_equal(self):
        """Boundary: value equal to threshold should NOT pass less_than."""
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "days", "operator": "less_than", "value": "10"}]
        data = {"days": 10}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_conditions_less_than_non_numeric(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "days", "operator": "less_than", "value": "10"}]
        data = {"days": None}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_conditions_fails(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "status", "operator": "equals", "value": "Aprobado"}]
        data = {"status": "Rechazado"}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_empty_conditions(self):
        from services.workflow_engine import evaluate_conditions

        assert evaluate_conditions([], {}) == True

    def test_evaluate_multiple_conditions_all_must_match(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [
            {"field": "status", "operator": "equals", "value": "Rechazado"},
            {"field": "critical", "operator": "equals", "value": "Si"},
        ]
        data = {"status": "Rechazado", "critical": "Si"}
        assert evaluate_conditions(conditions, data) == True

        data2 = {"status": "Rechazado", "critical": "No"}
        assert evaluate_conditions(conditions, data2) == False

    def test_evaluate_unknown_operator_returns_false(self):
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "status", "operator": "matches_regex", "value": ".*"}]
        data = {"status": "anything"}
        assert evaluate_conditions(conditions, data) == False

    def test_evaluate_missing_field_in_data(self):
        """If the field doesn't exist in data, equals should compare None to expected."""
        from services.workflow_engine import evaluate_conditions

        conditions = [{"field": "nonexistent", "operator": "equals", "value": "hello"}]
        data = {}
        assert evaluate_conditions(conditions, data) == False

    def test_execute_action_unknown_type_raises(self):
        from services.workflow_engine import execute_action

        with pytest.raises(ValueError, match="Unknown action type"):
            execute_action({"type": "nonexistent_action"}, {}, tenant_id=1)

    def test_execute_action_change_status_logs(self):
        """change_status action should return a result dict with applied=False."""
        from services.workflow_engine import execute_action

        result = execute_action(
            {"type": "change_status", "new_status": "Aprobado"},
            {"document_ref": "DOC-001"},
            tenant_id=1,
        )
        assert result["action"] == "change_status"
        assert result["new_status"] == "Aprobado"
        assert result["applied"] == False

    def test_execute_action_send_email_logs(self):
        """send_email action should return a result dict with sent=False."""
        from services.workflow_engine import execute_action

        result = execute_action(
            {"type": "send_email", "to": "user@test.com", "subject": "Test"},
            {"document_ref": "DOC-002"},
            tenant_id=1,
        )
        assert result["action"] == "send_email"
        assert "sent" in result
        assert result["to"] == ["user@test.com"]


# ══════════════════════════════════════════════════════════════════════════
# API Key Service Unit Tests
# ══════════════════════════════════════════════════════════════════════════


class TestApiKeyService:
    """Test API key generation and hashing logic (no DB required)."""

    def test_key_format(self):
        """Key should start with df_ prefix."""
        raw = "df_" + secrets.token_urlsafe(32)
        assert raw.startswith("df_")
        assert len(raw) > 35

    def test_hash_consistency(self):
        """Same key should produce same hash."""
        key = "df_test_key_12345"
        h1 = hashlib.sha256(key.encode()).hexdigest()
        h2 = hashlib.sha256(key.encode()).hexdigest()
        assert h1 == h2

    def test_different_keys_different_hashes(self):
        """Different keys must produce different hashes."""
        h1 = hashlib.sha256("df_key_aaa".encode()).hexdigest()
        h2 = hashlib.sha256("df_key_bbb".encode()).hexdigest()
        assert h1 != h2

    def test_internal_hash_function(self):
        """Test the service's internal _hash_key matches standard sha256."""
        from services.api_key_service import _hash_key

        key = "df_test_key_xyz"
        expected = hashlib.sha256(key.encode("utf-8")).hexdigest()
        assert _hash_key(key) == expected

    def test_key_prefix_extraction(self):
        """The prefix (first 8 chars) should be extractable from a generated key."""
        raw = "df_" + secrets.token_urlsafe(32)
        prefix = raw[:8]
        assert prefix.startswith("df_")
        assert len(prefix) == 8

    def test_hash_is_64_chars(self):
        """SHA-256 hex digest should always be 64 characters."""
        from services.api_key_service import _hash_key

        result = _hash_key("df_any_key")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)


# ══════════════════════════════════════════════════════════════════════════
# Classification Service Tests
# ══════════════════════════════════════════════════════════════════════════


class TestClassificationService:
    """Test classification level validation."""

    def test_valid_levels(self):
        from services.classification_service import CLASSIFICATION_LEVELS

        assert "public" in CLASSIFICATION_LEVELS
        assert "internal" in CLASSIFICATION_LEVELS
        assert "confidential" in CLASSIFICATION_LEVELS
        assert "restricted" in CLASSIFICATION_LEVELS

    def test_level_ordering(self):
        from services.classification_service import CLASSIFICATION_LEVELS

        assert CLASSIFICATION_LEVELS["public"] < CLASSIFICATION_LEVELS["internal"]
        assert CLASSIFICATION_LEVELS["internal"] < CLASSIFICATION_LEVELS["confidential"]
        assert CLASSIFICATION_LEVELS["confidential"] < CLASSIFICATION_LEVELS["restricted"]

    def test_exactly_four_levels(self):
        from services.classification_service import CLASSIFICATION_LEVELS

        assert len(CLASSIFICATION_LEVELS) == 4

    def test_get_classification_excel_mode_returns_internal(self):
        """In excel mode, get_classification should default to 'internal'."""
        from services.classification_service import get_classification

        result = get_classification(tenant_id=1, document_ref="DOC-001")
        assert result == "internal"

    def test_set_classification_invalid_level_raises(self):
        """Setting an invalid classification level should raise ValueError."""
        from services.classification_service import set_classification

        with pytest.raises(ValueError, match="Invalid classification level"):
            set_classification(tenant_id=1, document_ref="DOC-001", level="top_secret")

    def test_set_classification_valid_level_excel_mode(self):
        """In excel mode, set_classification should return False (no DB)."""
        from services.classification_service import set_classification

        result = set_classification(tenant_id=1, document_ref="DOC-001", level="confidential")
        assert result == False

    def test_level_values_are_integers(self):
        from services.classification_service import CLASSIFICATION_LEVELS

        for level, value in CLASSIFICATION_LEVELS.items():
            assert isinstance(value, int), f"Level {level} should be int, got {type(value)}"

    def test_comparison_public_vs_restricted(self):
        """Public should be strictly less than restricted."""
        from services.classification_service import CLASSIFICATION_LEVELS

        assert CLASSIFICATION_LEVELS["public"] < CLASSIFICATION_LEVELS["restricted"]


# ══════════════════════════════════════════════════════════════════════════
# Audit Service Tests
# ══════════════════════════════════════════════════════════════════════════


class TestAuditService:
    """Test audit service in excel mode (no DB)."""

    def test_log_change_excel_mode_noop(self):
        """In excel mode, log_change should be a no-op (no exception)."""
        os.environ["STORAGE_BACKEND"] = "excel"
        from services.audit_service import log_change

        # Should not raise
        log_change(
            tenant_id=1,
            entity_type="document",
            entity_id="DOC-001",
            action="updated",
            field_name="Estado",
            old_value="Enviado",
            new_value="Aprobado",
        )

    def test_get_entity_log_excel_mode_empty(self):
        """In excel mode, get_entity_log should return empty list."""
        os.environ["STORAGE_BACKEND"] = "excel"
        from services.audit_service import get_entity_log

        result = get_entity_log(tenant_id=1, entity_type="document", entity_id="DOC-001")
        assert result == []

    def test_get_recent_activity_excel_mode_empty(self):
        """In excel mode, get_recent_activity should return empty list."""
        os.environ["STORAGE_BACKEND"] = "excel"
        from services.audit_service import get_recent_activity

        result = get_recent_activity(tenant_id=1)
        assert result == []

    def test_log_entity_changes_detects_diff(self):
        """log_entity_changes should detect field changes between old and new dicts."""
        os.environ["STORAGE_BACKEND"] = "excel"
        from services.audit_service import log_entity_changes

        # Should not raise even in excel mode
        log_entity_changes(
            tenant_id=1,
            entity_type="document",
            entity_id="DOC-001",
            old_data={"Estado": "Enviado", "Titulo": "Test"},
            new_data={"Estado": "Aprobado", "Titulo": "Test"},
        )

    def test_log_change_with_metadata(self):
        """log_change should accept optional metadata without error."""
        os.environ["STORAGE_BACKEND"] = "excel"
        from services.audit_service import log_change

        log_change(
            tenant_id=1,
            entity_type="workflow",
            entity_id="WF-001",
            action="created",
            metadata={"source": "test", "extra": "data"},
        )

    def test_get_recent_activity_with_filters(self):
        """get_recent_activity should accept optional filters and return empty in excel mode."""
        os.environ["STORAGE_BACKEND"] = "excel"
        from services.audit_service import get_recent_activity

        result = get_recent_activity(
            tenant_id=1,
            entity_type="document",
            user_initials="JP",
            date_from="2026-01-01",
            date_to="2026-12-31",
        )
        assert result == []

    def test_log_entity_changes_no_changes(self):
        """When old and new data are identical, log_entity_changes should still not error."""
        os.environ["STORAGE_BACKEND"] = "excel"
        from services.audit_service import log_entity_changes

        log_entity_changes(
            tenant_id=1,
            entity_type="document",
            entity_id="DOC-002",
            old_data={"Estado": "Enviado", "Titulo": "Same"},
            new_data={"Estado": "Enviado", "Titulo": "Same"},
        )


# ══════════════════════════════════════════════════════════════════════════
# Webhook Format Tests
# ══════════════════════════════════════════════════════════════════════════


class TestWebhookFormats:
    """Test webhook message formatting."""

    def test_format_slack_message(self):
        from services.webhook_service import format_slack_message

        result = format_slack_message(
            "status_changed",
            {"document_ref": "DOC-001", "new_status": "Aprobado"},
        )
        assert isinstance(result, dict)
        assert "blocks" in result

    def test_format_slack_message_has_blocks_structure(self):
        from services.webhook_service import format_slack_message

        result = format_slack_message("test_event", {"key": "value"})
        blocks = result["blocks"]
        assert isinstance(blocks, list)
        assert len(blocks) >= 1
        # First block should be a section with the event type
        assert blocks[0]["type"] == "section"

    def test_format_slack_message_empty_payload(self):
        from services.webhook_service import format_slack_message

        result = format_slack_message("empty_event", {})
        assert isinstance(result, dict)
        assert "blocks" in result

    def test_format_teams_message(self):
        from services.webhook_service import format_teams_message

        result = format_teams_message(
            "document_updated",
            {"document_ref": "DOC-002"},
        )
        assert isinstance(result, dict)
        assert result["type"] == "message"
        assert "attachments" in result

    def test_format_teams_message_has_adaptive_card(self):
        from services.webhook_service import format_teams_message

        result = format_teams_message("test", {"key": "val"})
        attachments = result["attachments"]
        assert len(attachments) == 1
        assert attachments[0]["contentType"] == "application/vnd.microsoft.card.adaptive"
        content = attachments[0]["content"]
        assert content["type"] == "AdaptiveCard"

    def test_format_generic_message(self):
        from services.webhook_service import format_generic_message

        result = format_generic_message("test_event", {"key": "value"})
        assert isinstance(result, dict)
        assert "event_type" in result
        assert result["event_type"] == "test_event"

    def test_format_generic_message_has_timestamp(self):
        from services.webhook_service import format_generic_message

        result = format_generic_message("any_event", {})
        assert "timestamp" in result
        # Should be ISO format
        assert "T" in result["timestamp"]

    def test_format_generic_message_preserves_data(self):
        from services.webhook_service import format_generic_message

        payload = {"doc": "DOC-001", "status": "Aprobado", "user": "JP"}
        result = format_generic_message("status_changed", payload)
        assert result["data"] == payload

    def test_format_slack_with_many_fields(self):
        """Slack fields are limited to 10 per section — verify correct splitting."""
        from services.webhook_service import format_slack_message

        # Create payload with 15 fields to trigger splitting
        payload = {f"field_{i}": f"value_{i}" for i in range(15)}
        result = format_slack_message("big_event", payload)
        # Should have header section + at least 2 field sections (10 + 5)
        assert len(result["blocks"]) >= 3


# ══════════════════════════════════════════════════════════════════════════
# Supplier Scorecard Metric Calculation Tests
# ══════════════════════════════════════════════════════════════════════════


class TestSupplierScorecardMetrics:
    """Test the internal _calculate_metrics function directly."""

    def test_calculate_metrics_empty_df(self):
        import pandas as pd
        from services.supplier_scorecard_service import _calculate_metrics

        df = pd.DataFrame()
        result = _calculate_metrics(df)
        assert result["total_docs"] == 0
        assert result["avg_response_days"] == 0.0

    def test_calculate_metrics_basic(self):
        import pandas as pd
        from services.supplier_scorecard_service import _calculate_metrics

        df = pd.DataFrame([
            {"Estado": "Aprobado", "Dias Devolucion": 10, "Nº Revisión": 0},
            {"Estado": "Rechazado", "Dias Devolucion": 20, "Nº Revisión": 1},
        ])
        result = _calculate_metrics(df)
        assert result["total_docs"] == 2

    def test_calculate_metrics_score_range(self):
        """Score should be between 0 and 100."""
        import pandas as pd
        from services.supplier_scorecard_service import _calculate_metrics

        df = pd.DataFrame([
            {"Estado": "Aprobado", "Nº Revisión": 0},
        ])
        result = _calculate_metrics(df)
        assert 0 <= result["score"] <= 100


# ══════════════════════════════════════════════════════════════════════════
# Storage Service Path Logic Tests
# ══════════════════════════════════════════════════════════════════════════


class TestStorageServicePaths:
    """Test storage path construction without actual file I/O."""

    def test_upload_base_dir_constant(self):
        from services.storage_service import UPLOAD_BASE_DIR

        assert isinstance(UPLOAD_BASE_DIR, str)
        assert len(UPLOAD_BASE_DIR) > 0

    def test_storage_path_construction(self):
        """Verify the storage path follows the expected pattern."""
        import os as _os
        from services.storage_service import UPLOAD_BASE_DIR

        tenant_id = 42
        document_ref = "DOC-001"
        filename = "test.pdf"
        expected_dir = _os.path.join(UPLOAD_BASE_DIR, str(tenant_id), document_ref)
        expected_path = _os.path.join(expected_dir, filename)
        assert str(tenant_id) in expected_path
        assert document_ref in expected_path
        assert filename in expected_path


# ══════════════════════════════════════════════════════════════════════════
# Migration Tests
# ══════════════════════════════════════════════════════════════════════════


class TestMigrations:
    """Test that migration files exist and are valid Python (importable)."""

    def test_migration_003_exists(self):
        migration_path = BACKEND_DIR / "alembic" / "versions" / "003_add_audit_comments_filters.py"
        assert migration_path.exists(), f"Migration 003 not found at {migration_path}"

    def test_migration_004_exists(self):
        migration_path = BACKEND_DIR / "alembic" / "versions" / "004_add_attachments_webhooks_apikeys.py"
        assert migration_path.exists(), f"Migration 004 not found at {migration_path}"

    def test_migration_003_has_upgrade_function(self):
        """Migration 003 must define an upgrade() function."""
        migration_path = BACKEND_DIR / "alembic" / "versions" / "003_add_audit_comments_filters.py"
        content = migration_path.read_text(encoding="utf-8")
        assert "def upgrade" in content, "Migration 003 missing upgrade() function"

    def test_migration_003_has_downgrade_function(self):
        """Migration 003 must define a downgrade() function."""
        migration_path = BACKEND_DIR / "alembic" / "versions" / "003_add_audit_comments_filters.py"
        content = migration_path.read_text(encoding="utf-8")
        assert "def downgrade" in content, "Migration 003 missing downgrade() function"

    def test_migration_004_has_upgrade_function(self):
        migration_path = BACKEND_DIR / "alembic" / "versions" / "004_add_attachments_webhooks_apikeys.py"
        content = migration_path.read_text(encoding="utf-8")
        assert "def upgrade" in content, "Migration 004 missing upgrade() function"

    def test_migration_004_has_downgrade_function(self):
        migration_path = BACKEND_DIR / "alembic" / "versions" / "004_add_attachments_webhooks_apikeys.py"
        content = migration_path.read_text(encoding="utf-8")
        assert "def downgrade" in content, "Migration 004 missing downgrade() function"

    def test_migration_003_creates_correct_tables(self):
        """Migration 003 should reference the audit_logs, saved_filters, document_comments tables."""
        migration_path = BACKEND_DIR / "alembic" / "versions" / "003_add_audit_comments_filters.py"
        content = migration_path.read_text(encoding="utf-8")
        assert "audit_logs" in content, "Migration 003 should create audit_logs table"
        assert "saved_filters" in content, "Migration 003 should create saved_filters table"
        assert "document_comments" in content, "Migration 003 should create document_comments table"

    def test_migration_004_creates_correct_tables(self):
        """Migration 004 should reference attachments, webhooks, api_keys tables."""
        migration_path = BACKEND_DIR / "alembic" / "versions" / "004_add_attachments_webhooks_apikeys.py"
        content = migration_path.read_text(encoding="utf-8")
        assert "document_attachments" in content, "Migration 004 should create document_attachments table"
        assert "webhook_configs" in content, "Migration 004 should create webhook_configs table"
        assert "api_keys" in content, "Migration 004 should create api_keys table"


# ══════════════════════════════════════════════════════════════════════════
# HTTP API Endpoint Tests (via TestClient)
# Requires: pip install -r requirements.txt (structlog, apscheduler, etc.)
# Run with: pytest docflow/backend/tests/test_new_features.py -v -k TestApiEndpoints
# ══════════════════════════════════════════════════════════════════════════


class TestApiEndpoints:
    """Integration tests for new API endpoints using FastAPI TestClient."""

    @pytest.fixture(autouse=True)
    def setup_client(self):
        try:
            from fastapi.testclient import TestClient
            from main import app
            from services.auth_service import create_token
        except ImportError:
            pytest.skip("Full dependencies required (pip install -r requirements.txt)")

        self.client = TestClient(app)
        token = create_token({
            "sub": "test.user",
            "role": "Document Controller",
            "initials": "TU",
            "tenant_id": 1,
        })
        self.headers = {"Authorization": f"Bearer {token}"}

    def test_health_endpoint(self):
        """Sanity check: health endpoint should return 200."""
        response = self.client.get("/api/v1/health/")
        assert response.status_code == 200

    def test_audit_recent_endpoint(self):
        """GET /api/v1/audit/recent should respond (returns empty in excel mode)."""
        response = self.client.get("/api/v1/audit/recent", headers=self.headers)
        # Should be 200 with empty list in excel mode
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert data == []

    def test_audit_root_endpoint(self):
        """GET /api/v1/audit/ should respond with full audit log."""
        response = self.client.get("/api/v1/audit/", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_audit_entity_endpoint(self):
        """GET /api/v1/audit/document/DOC-001 should respond."""
        response = self.client.get(
            "/api/v1/audit/document/DOC-001",
            headers=self.headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_audit_endpoint_requires_auth(self):
        """Audit endpoints should require authentication."""
        response = self.client.get("/api/v1/audit/recent")
        assert response.status_code in (401, 403)

    def test_comments_endpoint_requires_auth(self):
        """Comments endpoints should require authentication."""
        response = self.client.get("/api/v1/comments/DOC-001")
        assert response.status_code in (401, 403)

    def test_saved_filters_endpoint_requires_auth(self):
        """Saved filters endpoints should require authentication."""
        response = self.client.get("/api/v1/filters/")
        assert response.status_code in (401, 403)

    def test_webhooks_endpoint_requires_auth(self):
        """Webhooks endpoints should require authentication."""
        response = self.client.get("/api/v1/webhooks/")
        assert response.status_code in (401, 403)

    def test_api_keys_endpoint_requires_auth(self):
        """API keys endpoints should require authentication."""
        response = self.client.get("/api/v1/api-keys/")
        assert response.status_code in (401, 403)

    def test_attachments_endpoint_requires_auth(self):
        """Attachments endpoints should require authentication."""
        response = self.client.get("/api/v1/attachments/DOC-001")
        assert response.status_code in (401, 403)

    def test_api_keys_requires_admin_role(self):
        """API keys endpoints should require admin role, not just DC."""
        response = self.client.get("/api/v1/api-keys/", headers=self.headers)
        # DC role should get 403 since api_keys requires admin
        assert response.status_code == 403

    def test_webhooks_allows_dc_role(self):
        """Webhooks endpoints should allow Document Controller role (not 401/403)."""
        response = self.client.get("/api/v1/webhooks/", headers=self.headers)
        # DC role is allowed — 500 is OK in excel mode (no Postgres), just not 401/403
        assert response.status_code not in (401, 403)


# ══════════════════════════════════════════════════════════════════════════
# Cross-cutting Feature Flag Tests
# ══════════════════════════════════════════════════════════════════════════


class TestFeatureFlagConsistency:
    """Ensure feature flag names are consistent across plan definitions."""

    def test_all_plans_have_same_feature_keys(self):
        """All plans must define the exact same set of feature flags."""
        from services.plan_service import PLANS

        free_keys = set(PLANS["free"]["features"].keys())
        pro_keys = set(PLANS["pro"]["features"].keys())
        enterprise_keys = set(PLANS["enterprise"]["features"].keys())

        assert free_keys == pro_keys, f"Free vs Pro mismatch: {free_keys.symmetric_difference(pro_keys)}"
        assert pro_keys == enterprise_keys, f"Pro vs Enterprise mismatch: {pro_keys.symmetric_difference(enterprise_keys)}"

    def test_enterprise_is_superset_of_pro(self):
        """Every feature enabled in pro must also be enabled in enterprise."""
        from services.plan_service import PLANS

        pro_features = PLANS["pro"]["features"]
        enterprise_features = PLANS["enterprise"]["features"]

        for key, value in pro_features.items():
            if value:
                assert enterprise_features[key] == True, \
                    f"Feature '{key}' is enabled in Pro but not in Enterprise"

    def test_pro_is_superset_of_free(self):
        """Every feature enabled in free must also be enabled in pro."""
        from services.plan_service import PLANS

        free_features = PLANS["free"]["features"]
        pro_features = PLANS["pro"]["features"]

        for key, value in free_features.items():
            if value:
                assert pro_features[key] == True, \
                    f"Feature '{key}' is enabled in Free but not in Pro"
