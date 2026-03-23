"""Tests for plan service — feature flags and quotas."""

import os
import pytest
from unittest.mock import patch, MagicMock


def test_plans_have_required_keys():
    """All plans should have the expected structure."""
    from services.plan_service import PLANS
    for plan_name in ("free", "pro", "enterprise"):
        plan = PLANS[plan_name]
        assert "max_users" in plan
        assert "max_documents" in plan
        assert "max_api_calls_per_month" in plan
        assert "features" in plan


def test_free_plan_limits():
    """Free plan should have restrictive limits."""
    from services.plan_service import PLANS
    free = PLANS["free"]
    assert free["max_users"] == 3
    assert free["max_documents"] == 500
    assert free["features"]["workflows"] is False
    assert free["features"]["ai"] is False


def test_pro_plan_has_workflows():
    """Pro plan should have workflows enabled."""
    from services.plan_service import PLANS
    assert PLANS["pro"]["features"]["workflows"] is True


def test_enterprise_unlimited():
    """Enterprise plan should have unlimited (-1) quotas."""
    from services.plan_service import PLANS
    ent = PLANS["enterprise"]
    assert ent["max_users"] == -1
    assert ent["max_documents"] == -1
    assert ent["max_api_calls_per_month"] == -1


def test_get_plan_excel_mode():
    """In Excel mode, get_plan returns 'enterprise'."""
    with patch.dict(os.environ, {"STORAGE_BACKEND": "excel"}):
        from services.plan_service import get_plan
        assert get_plan(1) == "enterprise"


def test_check_feature_enterprise():
    """Enterprise plan should have all features."""
    with patch.dict(os.environ, {"STORAGE_BACKEND": "excel"}):
        from services.plan_service import check_feature
        assert check_feature(1, "workflows") is True
        assert check_feature(1, "ai") is True
        assert check_feature(1, "docusign") is True


def test_get_features_returns_dict():
    """get_features should return a dict of feature flags."""
    with patch.dict(os.environ, {"STORAGE_BACKEND": "excel"}):
        from services.plan_service import get_features
        features = get_features(1)
        assert isinstance(features, dict)
        assert "workflows" in features


def test_get_limits_returns_dict():
    """get_limits should return quota limits."""
    with patch.dict(os.environ, {"STORAGE_BACKEND": "excel"}):
        from services.plan_service import get_limits
        limits = get_limits(1)
        assert "max_users" in limits
        assert "max_documents" in limits
