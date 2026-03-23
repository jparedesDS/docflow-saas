import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Table, CheckCircle, XCircle, Info } from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";

function CoverageBar({ pct }) {
  const color = pct >= 80 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--bg-page, #E2E8F0)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color, minWidth: 30 }}>{pct}%</span>
    </div>
  );
}

function MatrixCell({ docs }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const hasDocs = docs && docs.length > 0;

  return (
    <td
      style={{
        padding: "6px 8px", textAlign: "center",
        position: "relative", cursor: hasDocs ? "pointer" : "default",
      }}
      onMouseEnter={() => hasDocs && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {hasDocs ? (
        <CheckCircle size={16} weight="fill" style={{ color: "#16A34A" }} />
      ) : (
        <XCircle size={16} weight="fill" style={{ color: "#DC262640" }} />
      )}

      {showTooltip && hasDocs && (
        <div style={{
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
          marginBottom: 4, zIndex: 100, width: 220,
          background: "var(--bg-card, #fff)", color: "var(--text-main, #1E293B)",
          border: "1px solid var(--border, #E2E8F0)",
          borderRadius: 8, padding: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          fontSize: 11, textAlign: "left",
        }}>
          {docs.map((d, i) => (
            <div key={i} style={{
              padding: "3px 0",
              borderBottom: i < docs.length - 1 ? "1px solid var(--border, #E2E8F0)" : "none",
            }}>
              <span style={{ fontWeight: 600 }}>{d.doc_ref}</span>
              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-muted, #64748B)" }}>
                {d.estado || "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </td>
  );
}

export default function TraceabilityMatrix({ pedido }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pedido) return;
    setLoading(true);
    setError(null);
    api.get(`/projects/${encodeURIComponent(pedido)}/traceability`)
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.detail || "Error cargando matriz"))
      .finally(() => setLoading(false));
  }, [pedido]);

  if (!pedido) return null;

  if (loading) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p className="text-text-muted" style={{ fontSize: 13 }}>{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "#DC2626", fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  // Empty state — no data at all
  if (!data || data.mode === "empty") {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <Table size={32} weight="thin" style={{ color: "var(--text-muted)", marginBottom: 8 }} />
        <p className="text-text-muted" style={{ fontSize: 13 }}>{t("traceNoMaterials")}</p>
      </div>
    );
  }

  // Doctype summary fallback — when Material column is empty
  if (data.mode === "doctype_summary") {
    const stats = data.type_stats || {};
    const types = Object.keys(stats).sort();
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header with overall coverage */}
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Info size={16} weight="bold" style={{ color: "var(--accent)" }} />
              <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>
                {t("traceByDocType")}: {data.overall_coverage}%
              </span>
            </div>
            <span className="text-text-muted" style={{ fontSize: 11 }}>
              {data.total_docs} docs
            </span>
          </div>
          <CoverageBar pct={data.overall_coverage} />
          <p className="text-text-muted" style={{ fontSize: 11, marginTop: 8, fontStyle: "italic" }}>
            {t("traceNoMaterialInfo")}
          </p>
        </div>

        {/* Grid of type cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {types.map((tipo, i) => {
            const s = stats[tipo];
            const pctType = s.total > 0 ? Math.round((s.aprobados / s.total) * 100) : 0;
            const barColor = pctType >= 80 ? "#16A34A" : pctType >= 50 ? "#D97706" : "#DC2626";
            return (
              <motion.div
                key={tipo}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="card"
                style={{ padding: 14 }}
              >
                <p className="text-text-main" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={tipo}>
                  {tipo}
                </p>
                <div style={{ height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${pctType}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width 0.4s ease" }} />
                </div>
                <p className="text-text-muted" style={{ fontSize: 11, marginBottom: 4 }}>
                  {s.aprobados} / {s.total} {t("docsApproved")}
                </p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {s.aprobados > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "#16A34A18", color: "#16A34A" }}>✓{s.aprobados}</span>}
                  {s.enviados > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "#2563EB18", color: "#2563EB" }}>↑{s.enviados}</span>}
                  {s.pendientes > 0 && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "#D9770618", color: "#D97706" }}>○{s.pendientes}</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    );
  }

  // Material matrix — original view (mode="material" or legacy without mode)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Overall coverage */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Info size={16} weight="bold" style={{ color: "var(--accent)" }} />
          <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>
            {t("traceCoverage")}: {data.overall_coverage}%
          </span>
        </div>
        <span className="text-text-muted" style={{ fontSize: 11 }}>
          {data.materials.length} {t("traceMaterials")} × {data.doc_types.length} {t("traceDocTypes")}
        </span>
      </div>

      {/* Matrix table */}
      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{
                padding: "10px 12px", textAlign: "left",
                fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.06em",
                position: "sticky", left: 0, background: "var(--bg-card)",
                minWidth: 140,
              }}>
                Material
              </th>
              {data.doc_types.map(dt => (
                <th key={dt} style={{
                  padding: "10px 8px", textAlign: "center",
                  fontSize: 9, fontWeight: 700, color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}>
                  {dt}
                </th>
              ))}
              <th style={{
                padding: "10px 12px", textAlign: "center",
                fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", minWidth: 100,
              }}>
                {t("traceCoverage")}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.materials.map((mat, rowIdx) => (
              <tr
                key={mat}
                style={{
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: rowIdx % 2 === 0 ? "transparent" : "var(--bg-page)",
                }}
              >
                <td style={{
                  padding: "8px 12px", fontWeight: 600, fontSize: 11,
                  color: "var(--text-main)",
                  position: "sticky", left: 0,
                  background: rowIdx % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)",
                  maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
                  title={mat}
                >
                  {mat}
                </td>
                {data.doc_types.map(dt => (
                  <MatrixCell key={dt} docs={data.matrix[mat]?.[dt] || []} />
                ))}
                <td style={{ padding: "8px 12px" }}>
                  <CoverageBar pct={data.coverage[mat]?.pct || 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
