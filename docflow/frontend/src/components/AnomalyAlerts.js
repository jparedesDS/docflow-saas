import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Warning, CaretDown, CaretUp } from "@phosphor-icons/react";
import { useI18n } from "../contexts/I18nContext";
import SectionTitle from "./ui/SectionTitle";

function getZScoreColor(z) {
  if (z >= 3) return "#DC2626";
  if (z >= 2) return "#D97706";
  return "#16A34A";
}

export default function AnomalyAlerts({ anomalyData }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  if (!anomalyData) return null;

  const anomalies = anomalyData.anomalies || [];
  const clientStats = anomalyData.client_stats || [];
  const totalAnomalies = anomalyData.total_anomalies || 0;

  if (totalAnomalies === 0) {
    return (
      <div className="card p-5">
        <SectionTitle>{t("anomalies")}</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0", gap: 8 }}>
          <Warning size={18} weight="thin" style={{ color: "var(--text-muted)" }} />
          <span className="text-text-muted" style={{ fontSize: 13 }}>{t("noAnomalies")}</span>
        </div>
      </div>
    );
  }

  const displayAnomalies = expanded ? anomalies : anomalies.slice(0, 5);

  return (
    <div className="card p-5">
      <SectionTitle>{t("anomalies")} ({totalAnomalies})</SectionTitle>

      {/* Alert cards */}
      {displayAnomalies.map((a, i) => {
        const zColor = getZScoreColor(a.z_score);
        return (
          <motion.div
            key={a.doc_eipsa || i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0",
              borderBottom: i < displayAnomalies.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            {/* Warning icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: `${zColor}14`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Warning size={16} weight="fill" style={{ color: zColor }} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="text-text-main" style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.doc_eipsa} — {a.cliente}
              </p>
              <p className="text-text-muted" style={{ fontSize: 11, marginTop: 1 }}>
                {a.message}
              </p>
            </div>

            {/* Z-score badge */}
            <span style={{
              fontSize: 11, fontWeight: 800,
              padding: "3px 8px", borderRadius: 6,
              background: `${zColor}18`, color: zColor,
              flexShrink: 0, whiteSpace: "nowrap",
            }}>
              {a.z_score}{t("sigmaAbove")}
            </span>

            {/* Status */}
            <span className="text-text-muted" style={{ fontSize: 10, flexShrink: 0, fontWeight: 600 }}>
              {a.estado}
            </span>
          </motion.div>
        );
      })}

      {/* Show more / less */}
      {anomalies.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: 8, background: "transparent", border: "none",
            color: "var(--accent)", cursor: "pointer", fontSize: 12,
            fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
          }}
        >
          {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
          {expanded ? t("showLess") || "Mostrar menos" : `${t("showMore") || "Ver todos"} (${anomalies.length})`}
        </button>
      )}

      {/* Client stats table (expandable) */}
      {clientStats.length > 0 && (
        <ClientStatsTable stats={clientStats} />
      )}
    </div>
  );
}

function ClientStatsTable({ stats }) {
  const { t } = useI18n();
  const [showStats, setShowStats] = useState(false);

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setShowStats(!showStats)}
        style={{
          background: "transparent", border: "none",
          color: "var(--text-sub)", cursor: "pointer", fontSize: 11,
          fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
          padding: 0,
        }}
      >
        {showStats ? <CaretUp size={10} /> : <CaretDown size={10} />}
        {t("clientAvgResponse")} ({stats.length})
      </button>

      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "var(--bg-hover)" }}>
                    <th className="text-text-muted" style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>
                      {t("client")}
                    </th>
                    <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>
                      {t("clientAvgResponse")}
                    </th>
                    <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>
                      Std Dev
                    </th>
                    <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>
                      Min
                    </th>
                    <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>
                      Max
                    </th>
                    <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>
                      Docs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.slice(0, 15).map((s, i) => (
                    <tr key={s.cliente} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)" }}>
                      <td className="text-text-main" style={{ padding: "5px 10px", fontWeight: 600, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.cliente}
                      </td>
                      <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700, color: s.mean > 20 ? "#DC2626" : s.mean > 10 ? "#D97706" : "#16A34A" }}>
                        {Math.round(s.mean)}d
                      </td>
                      <td className="text-text-sub" style={{ padding: "5px 8px", textAlign: "center" }}>
                        {Math.round(s.std_dev)}d
                      </td>
                      <td className="text-text-sub" style={{ padding: "5px 8px", textAlign: "center" }}>
                        {Math.round(s.min)}d
                      </td>
                      <td className="text-text-sub" style={{ padding: "5px 8px", textAlign: "center" }}>
                        {Math.round(s.max)}d
                      </td>
                      <td className="text-text-sub" style={{ padding: "5px 8px", textAlign: "center" }}>
                        {s.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
