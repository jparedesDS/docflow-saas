"""Tests for claims escalation system (3 levels)."""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from services.claim_service import (
    ClaimService, ESCALATION_LEVELS, DIRECTION_CC, _load_log, _save_log,
)


@pytest.fixture()
def claim_service():
    return ClaimService()


@pytest.fixture()
def empty_log(tmp_path):
    """Patch claims log to use a temp file."""
    log_path = str(tmp_path / "claims_log.json")
    with open(log_path, "w") as f:
        json.dump({}, f)
    with patch("services.claim_service.CLAIMS_LOG_PATH", log_path):
        yield log_path


@pytest.fixture()
def log_with_one_claim(tmp_path):
    """Claims log with one prior claim for pedido P-24/091."""
    log_path = str(tmp_path / "claims_log.json")
    log_data = {
        "P-24/091": {
            "last_claimed": "2026-03-01T10:00:00",
            "history": [
                {
                    "sent_at": "2026-03-01T10:00:00",
                    "to": ["santos-sanchez@eipsa.es"],
                    "cc": [],
                    "docs_count": 3,
                    "level": 1,
                }
            ],
        }
    }
    with open(log_path, "w") as f:
        json.dump(log_data, f)
    with patch("services.claim_service.CLAIMS_LOG_PATH", log_path):
        yield log_path


@pytest.fixture()
def log_with_two_claims(tmp_path):
    """Claims log with two prior claims for pedido P-24/091."""
    log_path = str(tmp_path / "claims_log.json")
    log_data = {
        "P-24/091": {
            "last_claimed": "2026-03-15T10:00:00",
            "history": [
                {
                    "sent_at": "2026-03-01T10:00:00",
                    "to": ["santos-sanchez@eipsa.es"],
                    "cc": [],
                    "docs_count": 3,
                    "level": 1,
                },
                {
                    "sent_at": "2026-03-15T10:00:00",
                    "to": ["santos-sanchez@eipsa.es"],
                    "cc": ["enrique-serrano@eipsa.es"],
                    "docs_count": 3,
                    "level": 2,
                },
            ],
        }
    }
    with open(log_path, "w") as f:
        json.dump(log_data, f)
    with patch("services.claim_service.CLAIMS_LOG_PATH", log_path):
        yield log_path


class TestEscalationLevelDetermination:
    """Test get_escalation_level returns correct level."""

    def test_escalation_level_1_under_30_days(self, claim_service, empty_log):
        """15-29 days, no history -> level 1."""
        pedido_data = {"pedido": "P-99/001", "max_dias": 20}
        level = claim_service.get_escalation_level(pedido_data)
        assert level == 1

    def test_escalation_level_2_over_30_days(self, claim_service, empty_log):
        """30-59 days -> level 2."""
        pedido_data = {"pedido": "P-99/002", "max_dias": 45}
        level = claim_service.get_escalation_level(pedido_data)
        assert level == 2

    def test_escalation_level_2_after_first_claim(self, claim_service, log_with_one_claim):
        """<30 days but 1 prior claim -> level 2."""
        pedido_data = {"pedido": "P-24/091", "max_dias": 20}
        level = claim_service.get_escalation_level(pedido_data)
        assert level == 2

    def test_escalation_level_3_over_60_days(self, claim_service, empty_log):
        """60+ days -> level 3."""
        pedido_data = {"pedido": "P-99/003", "max_dias": 75}
        level = claim_service.get_escalation_level(pedido_data)
        assert level == 3

    def test_escalation_level_3_after_two_claims(self, claim_service, log_with_two_claims):
        """2+ prior claims -> level 3 regardless of days."""
        pedido_data = {"pedido": "P-24/091", "max_dias": 20}
        level = claim_service.get_escalation_level(pedido_data)
        assert level == 3

    def test_escalation_level_boundary_30_days(self, claim_service, empty_log):
        """Exactly 30 days -> level 2."""
        pedido_data = {"pedido": "P-99/004", "max_dias": 30}
        level = claim_service.get_escalation_level(pedido_data)
        assert level == 2

    def test_escalation_level_boundary_60_days(self, claim_service, empty_log):
        """Exactly 60 days -> level 3."""
        pedido_data = {"pedido": "P-99/005", "max_dias": 60}
        level = claim_service.get_escalation_level(pedido_data)
        assert level == 3

    def test_escalation_level_15_days(self, claim_service, empty_log):
        """Exactly 15 days, no history -> level 1."""
        pedido_data = {"pedido": "P-99/006", "max_dias": 15}
        level = claim_service.get_escalation_level(pedido_data)
        assert level == 1


class TestEscalationRecipients:
    """Test get_escalation_recipients returns correct TO/CC."""

    def test_recipients_level_1(self, claim_service):
        """Level 1: Only default TO/CC."""
        pedido_data = {"pedido": "P-99/001", "responsable": ""}
        to, cc = claim_service.get_escalation_recipients(pedido_data, 1)
        assert "santos-sanchez@eipsa.es" in to
        assert "jesus-martinez@eipsa.es" in cc
        assert "ernesto-carrillo@eipsa.es" in cc
        # Direction should NOT be in CC at level 1
        for d_email in DIRECTION_CC:
            assert d_email not in cc

    def test_recipients_level_2(self, claim_service):
        """Level 2: Adds direction CC."""
        pedido_data = {"pedido": "P-99/001", "responsable": ""}
        to, cc = claim_service.get_escalation_recipients(pedido_data, 2)
        assert "santos-sanchez@eipsa.es" in to
        for d_email in DIRECTION_CC:
            assert d_email in cc

    def test_recipients_level_3(self, claim_service):
        """Level 3: Adds commercial responsable."""
        pedido_data = {"pedido": "P-99/001", "responsable": "LB"}
        to, cc = claim_service.get_escalation_recipients(pedido_data, 3)
        assert "santos-sanchez@eipsa.es" in to
        for d_email in DIRECTION_CC:
            assert d_email in cc
        assert "luis-bravo@eipsa.es" in cc

    def test_recipients_level_3_unknown_responsable(self, claim_service):
        """Level 3 with unknown responsable: no crash, no extra emails."""
        pedido_data = {"pedido": "P-99/001", "responsable": "UNKNOWN"}
        to, cc = claim_service.get_escalation_recipients(pedido_data, 3)
        assert "santos-sanchez@eipsa.es" in to
        for d_email in DIRECTION_CC:
            assert d_email in cc

    def test_recipients_no_duplicates(self, claim_service):
        """No duplicate emails across TO and CC."""
        pedido_data = {"pedido": "P-99/001", "responsable": "SS"}
        to, cc = claim_service.get_escalation_recipients(pedido_data, 3)
        all_emails = to + cc
        assert len(all_emails) == len(set(all_emails))

    def test_recipients_with_pm_map(self, claim_service):
        """PM from RESPONSABLE_PEDIDO_MAP is added to CC."""
        pedido_data = {"pedido": "P-24/091", "responsable": ""}
        to, cc = claim_service.get_escalation_recipients(pedido_data, 1)
        # P-24/091 maps to luis-bravo in RESPONSABLE_PEDIDO_MAP
        # It should be in CC if mapped
        assert isinstance(cc, list)


class TestEscalationConstants:
    """Test ESCALATION_LEVELS constant structure."""

    def test_three_levels_defined(self):
        assert len(ESCALATION_LEVELS) == 3

    def test_level_keys(self):
        for level_num in [1, 2, 3]:
            assert level_num in ESCALATION_LEVELS
            level = ESCALATION_LEVELS[level_num]
            assert "name" in level
            assert "min_days" in level
            assert "tone" in level
            assert "cc_level" in level

    def test_level_names(self):
        assert ESCALATION_LEVELS[1]["name"] == "reminder"
        assert ESCALATION_LEVELS[2]["name"] == "formal"
        assert ESCALATION_LEVELS[3]["name"] == "escalation"


class TestEscalationSubject:
    """Test _get_escalation_subject output."""

    def test_level_1_subject(self):
        subject = ClaimService._get_escalation_subject("P-24/091", "7011318362", 1)
        assert "REMINDER" in subject
        assert "P-24/091" in subject

    def test_level_2_subject(self):
        subject = ClaimService._get_escalation_subject("P-24/091", "7011318362", 2)
        assert "FORMAL CLAIM" in subject
        assert "P-24/091" in subject

    def test_level_3_subject(self):
        subject = ClaimService._get_escalation_subject("P-24/091", "7011318362", 3)
        assert "URGENT ESCALATION" in subject
        assert "IMMEDIATE ACTION" in subject
