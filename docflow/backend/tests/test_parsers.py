"""Tests for email parsers -- ACONEX and SENDOC."""

import os
import pytest

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def _read_fixture(filename: str) -> str:
    path = os.path.join(FIXTURES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ---------------------------------------------------------------------------
# ACONEX parser
# ---------------------------------------------------------------------------

class TestAconexParser:
    """Tests for services.parsers.aconex_parser."""

    def test_can_parse_matches_aconex_sender(self):
        from services.parsers.aconex_parser import can_parse

        assert can_parse("noreply@aconex.com") is True
        assert can_parse("NOREPLY@ACONEX.COM") is True
        assert can_parse("someone@other.com") is False

    def test_extract_transmittal_code(self):
        from services.parsers.aconex_parser import extract_transmittal_code

        assert extract_transmittal_code("Transmittal ABC-DEFGH-123456 sent") == "ABC-DEFGH-123456"
        assert extract_transmittal_code("No code here") is None

    def test_extract_transmittal_code_multiple(self):
        from services.parsers.aconex_parser import extract_transmittal_code

        # Returns the first match
        result = extract_transmittal_code("ABC-DEFGH-111111 and XYZ-ABCDE-222222")
        assert result == "ABC-DEFGH-111111"

    def test_parse_returns_dataframe_with_final_columns(self):
        from services.parsers.aconex_parser import parse
        from services.parsers.base_parser import FINAL_COLUMNS

        html = _read_fixture("aconex_sample.html")
        df = parse(html, "Transmittal ABC-DEFGH-123456", "2026-03-24")

        assert len(df) >= 1
        assert list(df.columns) == FINAL_COLUMNS

    def test_parse_extracts_document_names(self):
        from services.parsers.aconex_parser import parse

        html = _read_fixture("aconex_sample.html")
        df = parse(html, "Transmittal ABC-DEFGH-123456", "2026-03-24")

        doc_names = df["Doc. EIPSA"].tolist()
        assert any("DOC-MDR" in str(n) for n in doc_names)

    def test_parse_extracts_correct_row_count(self):
        from services.parsers.aconex_parser import parse

        html = _read_fixture("aconex_sample.html")
        df = parse(html, "Transmittal ABC-DEFGH-123456", "2026-03-24")

        assert len(df) == 2

    def test_parse_extracts_titles(self):
        from services.parsers.aconex_parser import parse

        html = _read_fixture("aconex_sample.html")
        df = parse(html, "Transmittal ABC-DEFGH-123456", "2026-03-24")

        titles = df["Título"].tolist()
        assert "Motor Drawing Rev A" in titles
        assert "Pump Specification" in titles

    def test_parse_extracts_revisions(self):
        from services.parsers.aconex_parser import parse

        html = _read_fixture("aconex_sample.html")
        df = parse(html, "Transmittal ABC-DEFGH-123456", "2026-03-24")

        revisions = df["Rev."].tolist()
        assert "A" in revisions
        assert "B" in revisions

    def test_parse_sets_transmittal_code(self):
        from services.parsers.aconex_parser import parse

        html = _read_fixture("aconex_sample.html")
        df = parse(html, "Transmittal ABC-DEFGH-123456", "2026-03-24")

        assert all(df["Nº Transmittal"] == "ABC-DEFGH-123456")

    def test_parse_extracts_package_as_po(self):
        from services.parsers.aconex_parser import parse

        html = _read_fixture("aconex_sample.html")
        df = parse(html, "Transmittal ABC-DEFGH-123456", "2026-03-24")

        # Package "PKG-001" extracted from metadata table and used as PO
        assert all(df["PO"] == "PKG-001")

    def test_parse_empty_html_raises(self):
        from services.parsers.aconex_parser import parse

        with pytest.raises(ValueError):
            parse("<html><body><p>No tables here</p></body></html>",
                  "Subject", "2026-03-24")

    def test_parse_fills_fecha(self):
        from services.parsers.aconex_parser import parse

        html = _read_fixture("aconex_sample.html")
        df = parse(html, "Transmittal ABC-DEFGH-123456", "2026-03-24")

        assert df["Fecha"].notna().all()


# ---------------------------------------------------------------------------
# SENDOC parser
# ---------------------------------------------------------------------------

class TestSendocParser:
    """Tests for services.parsers.sendoc_parser."""

    def test_can_parse_matches_sendoc_sender(self):
        from services.parsers.sendoc_parser import can_parse

        assert can_parse("adminsendoc@corporate.sener") is True
        assert can_parse("ADMINSENDOC@CORPORATE.SENER") is True
        assert can_parse("someone@other.com") is False

    def test_extract_transmittal_code(self):
        from services.parsers.sendoc_parser import extract_transmittal_code

        assert extract_transmittal_code("SENER-TR-001-002") == "SENER-TR-001-002"
        assert extract_transmittal_code("NoCode") is None

    def test_extract_transmittal_code_single_word(self):
        from services.parsers.sendoc_parser import extract_transmittal_code

        # Single word without hyphens should not match
        assert extract_transmittal_code("SINGLEWORD") is None

    def test_parse_returns_dataframe_with_final_columns(self):
        from services.parsers.sendoc_parser import parse
        from services.parsers.base_parser import FINAL_COLUMNS

        html = _read_fixture("sendoc_sample.html")
        df = parse(html, "SENDOC SENER-TR-001-002", "2026-03-24")

        assert len(df) >= 1
        assert list(df.columns) == FINAL_COLUMNS

    def test_parse_extracts_reference(self):
        from services.parsers.sendoc_parser import parse

        html = _read_fixture("sendoc_sample.html")
        df = parse(html, "SENDOC SENER-TR-001-002", "2026-03-24")

        refs = df["Doc. EIPSA"].tolist()
        assert any("SENER" in str(r) for r in refs)

    def test_parse_extracts_title(self):
        from services.parsers.sendoc_parser import parse

        html = _read_fixture("sendoc_sample.html")
        df = parse(html, "SENDOC SENER-TR-001-002", "2026-03-24")

        titles = df["Título"].tolist()
        assert any("Heat Exchanger" in str(t) for t in titles)

    def test_parse_extracts_revision(self):
        from services.parsers.sendoc_parser import parse

        html = _read_fixture("sendoc_sample.html")
        df = parse(html, "SENDOC SENER-TR-001-002", "2026-03-24")

        revisions = df["Rev."].tolist()
        assert "02" in [str(r) for r in revisions]

    def test_parse_sets_transmittal_code(self):
        from services.parsers.sendoc_parser import parse

        html = _read_fixture("sendoc_sample.html")
        df = parse(html, "SENDOC SENER-TR-001-002", "2026-03-24")

        assert all(df["Nº Transmittal"] == "SENER-TR-001-002")

    def test_parse_extracts_process_flow_as_po(self):
        from services.parsers.sendoc_parser import parse

        html = _read_fixture("sendoc_sample.html")
        df = parse(html, "SENDOC SENER-TR-001-002", "2026-03-24")

        # Purchase Order column overrides PO: "PO-12345"
        po_values = df["PO"].tolist()
        assert any("PO-12345" in str(p) for p in po_values)

    def test_parse_too_few_tables_raises(self):
        from services.parsers.sendoc_parser import parse

        single_table = "<html><body><table><tr><td>A</td><td>B</td></tr></table></body></html>"
        with pytest.raises(ValueError, match="no contiene las tablas esperadas"):
            parse(single_table, "Subject", "2026-03-24")

    def test_parse_fills_fecha(self):
        from services.parsers.sendoc_parser import parse

        html = _read_fixture("sendoc_sample.html")
        df = parse(html, "SENDOC SENER-TR-001-002", "2026-03-24")

        assert df["Fecha"].notna().all()

    def test_parse_extracts_doc_type_from_title(self):
        from services.parsers.sendoc_parser import parse

        html = _read_fixture("sendoc_sample.html")
        df = parse(html, "SENDOC SENER-TR-001-002", "2026-03-24")

        # Title contains "DRAWINGS" -> DOC_TYPE_MAP should map it
        doc_types = df["Tipo de documento"].tolist()
        # The DOC_TYPE_MAP maps "DRAWINGS" -> some value; just verify it's not empty
        assert any(str(t).strip() != "" for t in doc_types)
