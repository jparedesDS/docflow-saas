"""Supplier scorecard service — EIPSA-specific client performance metrics."""

import math
import pandas as pd
from typing import Optional

from repositories.instances import data_repo, consulta_repo
from services.monitoring_service import MonitoringService


def get_scorecard(tenant_id: int) -> list:
    """Get a list of client scores with performance metrics.

    Score = 40% approval rate (first rev) + 30% inverse avg response days + 30% inverse critical ratio.
    """
    monitoring = MonitoringService(data_repo, consulta_repo)
    rows = monitoring.get_monitoring_data()

    if not rows:
        return []

    df = pd.DataFrame(rows)
    if "Cliente" not in df.columns:
        return []

    clients = df["Cliente"].dropna().unique()
    results = []

    for client in clients:
        client_df = df[df["Cliente"] == client]
        metrics = _calculate_metrics(client_df)
        metrics["client"] = client
        results.append(metrics)

    # Sort by score descending
    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    return results


def get_client_detail(tenant_id: int, client_name: str) -> Optional[dict]:
    """Get detailed metrics for a single client."""
    monitoring = MonitoringService(data_repo, consulta_repo)
    rows = monitoring.get_monitoring_data(cliente=client_name)

    if not rows:
        return None

    df = pd.DataFrame(rows)
    if df.empty:
        return None

    metrics = _calculate_metrics(df)
    metrics["client"] = client_name

    # Add per-status breakdown
    if "Estado" in df.columns:
        status_counts = df["Estado"].fillna("sin enviar").value_counts().to_dict()
        metrics["status_breakdown"] = status_counts

    # Add per-type breakdown
    if "Tipo Doc." in df.columns:
        type_counts = df["Tipo Doc."].dropna().value_counts().to_dict()
        metrics["type_breakdown"] = type_counts

    return metrics


def _calculate_metrics(df: pd.DataFrame) -> dict:
    """Calculate performance metrics for a DataFrame of documents."""
    total_docs = len(df)

    # Average response days ("Dias Devolucion")
    avg_response_days = 0.0
    if "Días Devolución" in df.columns:
        devol = pd.to_numeric(df["Días Devolución"], errors="coerce").dropna()
        if len(devol) > 0:
            avg_response_days = round(float(devol.mean()), 1)

    # Approval rate on first revision (rev 0 or 1)
    approval_rate_first_rev = 0.0
    if "Estado" in df.columns and "Nº Revisión" in df.columns:
        approved_states = {"Aprobado", "Aprobado con comentarios", "APROBADO", "APROBADO CON COMENTARIOS"}
        revisions = pd.to_numeric(df["Nº Revisión"], errors="coerce")
        first_rev_mask = revisions.fillna(0) <= 1
        first_rev_df = df[first_rev_mask]
        if len(first_rev_df) > 0:
            approved_first = first_rev_df[first_rev_df["Estado"].isin(approved_states)]
            approval_rate_first_rev = round(len(approved_first) / len(first_rev_df) * 100, 1)

    # Critical documents over 30 days
    critical_over_30d_pct = 0.0
    critical_docs_count = 0
    if "Crítico" in df.columns and "Días Envío" in df.columns:
        critical_df = df[df["Crítico"].fillna("").str.upper().isin(["SI", "SÍ", "YES", "TRUE", "1"])]
        if len(critical_df) > 0:
            dias = pd.to_numeric(critical_df["Días Envío"], errors="coerce").fillna(0)
            over_30 = (dias > 30).sum()
            critical_docs_count = int(over_30)
            critical_over_30d_pct = round(float(over_30) / len(critical_df) * 100, 1)

    # Composite score (0-100)
    # 40% approval rate + 30% inverse response time + 30% inverse critical ratio
    approval_component = approval_rate_first_rev * 0.4

    # Inverse response: 0 days = 100, 60+ days = 0
    if avg_response_days <= 0:
        response_component = 100.0
    elif avg_response_days >= 60:
        response_component = 0.0
    else:
        response_component = max(0, (60 - avg_response_days) / 60 * 100)
    response_component *= 0.3

    # Inverse critical ratio: 0% over 30d = 100, 100% = 0
    critical_component = max(0, (100 - critical_over_30d_pct)) * 0.3

    score = round(approval_component + response_component + critical_component, 1)

    return {
        "total_docs": total_docs,
        "avg_response_days": avg_response_days,
        "approval_rate_first_rev": approval_rate_first_rev,
        "critical_over_30d_pct": critical_over_30d_pct,
        "critical_docs_count": critical_docs_count,
        "score": score,
    }
