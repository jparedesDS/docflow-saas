import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendUp, TrendDown, Minus, ArrowClockwise } from "@phosphor-icons/react";
import SectionTitle from "./ui/SectionTitle";
import SkeletonCard from "./SkeletonCard";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";

const METRICS = [
  { key: "pct_aprobados", color: "#16A34A", label: "approvalRate" },
  { key: "velocidad_media", color: "#D97706", label: "avgVelocity" },
  { key: "docs_riesgo", color: "#DC2626", label: "docsAtRisk" },
];

function TrendIndicator({ current, previous }) {
  if (previous == null || current == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) {
    return <Minus size={12} style={{ color: "var(--text-muted)" }} />;
  }
  if (diff > 0) {
    return <TrendUp size={12} weight="bold" style={{ color: "#16A34A" }} />;
  }
  return <TrendDown size={12} weight="bold" style={{ color: "#DC2626" }} />;
}

function CustomTooltip({ active, payload, label }) {
  const { t } = useI18n();
  if (!active || !payload || !payload.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="card" style={{
      padding: "10px 14px", fontSize: 11, minWidth: 160,
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      border: "1px solid var(--border)",
    }}>
      <p className="text-text-main" style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
        {d.month}
        {d.live && <span style={{ marginLeft: 6, fontSize: 9, color: "var(--accent)", fontWeight: 800, textTransform: "uppercase" }}>LIVE</span>}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span className="text-text-muted">{t("totalDocs") || "Total docs"}</span>
          <span className="text-text-main" style={{ fontWeight: 700 }}>{d.total_docs}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#16A34A" }}>{t("approvalRate") || "% Aprobados"}</span>
          <span style={{ fontWeight: 700, color: "#16A34A" }}>{d.pct_aprobados}%</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#D97706" }}>{t("avgVelocity") || "Vel. media"}</span>
          <span style={{ fontWeight: 700, color: "#D97706" }}>{d.velocidad_media}d</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ color: "#DC2626" }}>{t("docsAtRisk") || "En riesgo"}</span>
          <span style={{ fontWeight: 700, color: "#DC2626" }}>{d.docs_riesgo}</span>
        </div>
      </div>
    </div>
  );
}

export default function KpiTrends() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/analytics/trends");
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  if (loading) {
    return <SkeletonCard height={280} />;
  }

  if (error || !data || !data.snapshots || data.snapshots.length === 0) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>{t("kpiTrends")}</SectionTitle>
        <p className="text-text-muted" style={{ fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          {error || t("noData")}
        </p>
      </div>
    );
  }

  const snapshots = data.snapshots;
  const lastTwo = snapshots.length >= 2 ? [snapshots[snapshots.length - 2], snapshots[snapshots.length - 1]] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card"
      style={{ padding: 20 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionTitle>{t("kpiTrends")} — {t("monthlyEvolution")}</SectionTitle>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={fetchTrends}
          className="text-text-muted"
          style={{
            padding: "4px 10px", borderRadius: 6, background: "none",
            border: "1px solid var(--border)", cursor: "pointer",
            fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <ArrowClockwise size={12} /> {t("refresh")}
        </motion.button>
      </div>

      {/* Mini KPI cards for latest values */}
      {lastTwo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {METRICS.map(m => {
            const current = lastTwo[1]?.[m.key];
            const previous = lastTwo[0]?.[m.key];
            const suffix = m.key === "pct_aprobados" ? "%" : m.key === "velocidad_media" ? "d" : "";
            return (
              <div key={m.key} style={{
                padding: "10px 14px", borderRadius: 8,
                background: m.color + "0A",
                border: `1px solid ${m.color}25`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                  <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {t(m.label)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{current}{suffix}</span>
                  <TrendIndicator current={current} previous={previous} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval rate area chart */}
      <div style={{ marginBottom: 20 }}>
        <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          {t("approvalRate")} (%)
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={snapshots} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradApproval" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="pct_aprobados"
              stroke="#16A34A"
              strokeWidth={2}
              fill="url(#gradApproval)"
              dot={{ r: 3, fill: "#16A34A", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#16A34A", stroke: "#FFF", strokeWidth: 2 }}
              strokeDasharray={(d) => d?.live ? "4 4" : undefined}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Velocity + Risk dual line chart */}
      <div>
        <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          {t("avgVelocity")} & {t("docsAtRisk")}
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={snapshots} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={36} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="velocidad_media"
              stroke="#D97706"
              strokeWidth={2}
              dot={{ r: 3, fill: "#D97706", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="docs_riesgo"
              stroke="#DC2626"
              strokeWidth={2}
              dot={{ r: 3, fill: "#DC2626", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
            <span style={{ width: 12, height: 2, background: "#D97706", borderRadius: 1, display: "inline-block" }} />
            <span className="text-text-muted">{t("avgVelocity")} (d)</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
            <span style={{ width: 12, height: 2, background: "#DC2626", borderRadius: 1, display: "inline-block" }} />
            <span className="text-text-muted">{t("docsAtRisk")}</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
