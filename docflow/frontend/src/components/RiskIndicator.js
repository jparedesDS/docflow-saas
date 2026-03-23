import React, { useState, useEffect } from "react";
import { Warning } from "@phosphor-icons/react";
import api from "../services/api";

function getRiskColor(score) {
  if (score >= 60) return "#DC2626";
  if (score >= 30) return "#D97706";
  if (score > 0) return "#16A34A";
  return "var(--text-muted)";
}

function getRiskLabel(score) {
  if (score >= 60) return "Alto";
  if (score >= 30) return "Medio";
  if (score > 0) return "Bajo";
  return "—";
}

export default function RiskIndicator({ documentRef, compact = false }) {
  const [risk, setRisk] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!documentRef) return;
    api.get(`/predictions/document/${encodeURIComponent(documentRef)}`)
      .then(res => setRisk(res.data))
      .catch(() => {});
  }, [documentRef]);

  if (!risk || risk.risk_score === 0) return null;

  const color = getRiskColor(risk.risk_score);
  const label = getRiskLabel(risk.risk_score);

  if (compact) {
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 10, fontWeight: 700, padding: "2px 6px",
          borderRadius: 999, border: `1px solid ${color}30`,
          background: `${color}12`, color,
          cursor: "default",
        }}
        title={risk.reasons.join(". ")}
      >
        <Warning size={10} weight="bold" />
        {risk.risk_score}
      </span>
    );
  }

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, fontWeight: 700, padding: "3px 8px",
          borderRadius: 999, border: `1px solid ${color}30`,
          background: `${color}12`, color,
          cursor: "default",
        }}
      >
        <Warning size={12} weight="bold" />
        Riesgo: {label} ({risk.risk_score})
      </span>

      {showTooltip && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 6,
          zIndex: 100, width: 280,
          background: "var(--bg-card, #fff)", color: "var(--text-main, #1E293B)",
          border: "1px solid var(--border, #E2E8F0)",
          borderRadius: 10, padding: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          fontSize: 12, lineHeight: 1.5,
        }}>
          <p style={{ fontWeight: 700, marginBottom: 6, color }}>
            <Warning size={14} weight="bold" style={{ verticalAlign: "middle", marginRight: 4 }} />
            Riesgo {label} — Score {risk.risk_score}/100
          </p>
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontWeight: 600, fontSize: 10, textTransform: "uppercase", color: "var(--text-muted, #64748B)", letterSpacing: "0.04em", marginBottom: 4 }}>
              Factores
            </p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {risk.reasons.map((r, i) => (
                <li key={i} style={{ marginBottom: 2 }}>{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 10, textTransform: "uppercase", color: "var(--text-muted, #64748B)", letterSpacing: "0.04em", marginBottom: 4 }}>
              Acciones sugeridas
            </p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {risk.actions.map((a, i) => (
                <li key={i} style={{ marginBottom: 2, color: "var(--text-secondary, #475569)" }}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
