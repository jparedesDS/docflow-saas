import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, Warning, ArrowsLeftRight, ChartBar, ArrowClockwise } from "@phosphor-icons/react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import KpiCard from "../components/ui/KpiCard";
import SectionTitle from "../components/ui/SectionTitle";
import SkeletonCard from "../components/SkeletonCard";

const RESP_COLORS = ["#4F46E5", "#0D9488", "#D97706", "#DC2626", "#6366F1", "#2563EB", "#16A34A", "#DB2777"];

function getBarColor(member, avgLoad, stdDev) {
  if (member.overload) return "#DC2626";
  if (member.total > avgLoad) return "#D97706";
  return "#16A34A";
}

function getStatusLabel(member, t) {
  if (member.overload) return t("overloaded");
  if (member.underload) return t("underloaded");
  return t("normal");
}

function getWorkloadColor(member) {
  if (member.overload) return "#DC2626";
  if (member.underload) return "#2563EB";
  return "#16A34A";
}

export default function TeamWorkload() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/analytics/team-workload");
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} style={{ height: 88 }} />)}
        </div>
        <SkeletonCard style={{ height: 300 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ textAlign: "center", color: "#DC2626" }}>
          <Warning size={32} style={{ margin: "0 auto 8px" }} />
          <p className="text-text-main" style={{ fontWeight: 700 }}>{t("errorLoadingData")}</p>
          <p className="text-text-muted" style={{ fontSize: 13 }}>{error}</p>
          <button onClick={fetchData} style={{ marginTop: 12, padding: "6px 16px", background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  const members = data?.members || [];
  const avgLoad = data?.avg_load || 0;
  const maxLoad = data?.max_load || 0;
  const stdDev = data?.std_dev || 0;
  const alerts = data?.alerts || [];

  // Find the member with max load
  const maxMember = members.reduce((acc, m) => m.total > (acc?.total || 0) ? m : acc, null);

  // Chart data sorted by total desc
  const chartData = [...members].sort((a, b) => b.total - a.total);

  const tooltipStyle = {
    contentStyle: {
      fontSize: 11, borderRadius: 8,
      border: "1px solid var(--border)",
      background: "var(--bg-card)",
      color: "var(--text-main)",
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Refresh button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="text-text-main" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          {t("teamWorkload")}
        </h2>
        <motion.button whileTap={{ scale: 0.95 }} onClick={fetchData}
          className="rounded-lg" style={{ padding: "6px 14px", background: "var(--accent)", color: "#FFF", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowClockwise size={14} /> {t("update")}
        </motion.button>
      </div>

      {/* Alerts banner */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border"
          style={{ padding: "12px 16px", background: "#DC262610", borderColor: "#DC262640" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Warning size={16} weight="fill" style={{ color: "#DC2626" }} />
            <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>
              {alerts.length} {t("alerts").toLowerCase()}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {alerts.map((a, i) => (
              <p key={i} className="text-text-sub" style={{ fontSize: 12 }}>
                <strong>{a.responsable}</strong>: {a.total} docs ({t("avgLoad")}: {a.avg})
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <KpiCard
          label={t("totalDocs")}
          value={members.reduce((s, m) => s + m.total, 0)}
          color="var(--accent)"
          icon={ChartBar}
          index={0}
        />
        <KpiCard
          label={t("avgLoad")}
          value={avgLoad}
          sub={t("avgLoad")}
          color="#0D9488"
          icon={ArrowsLeftRight}
          index={1}
        />
        <KpiCard
          label={t("maxLoad") || "Max"}
          value={maxMember ? `${maxMember.responsable}: ${maxLoad}` : maxLoad}
          color="#D97706"
          icon={Users}
          index={2}
        />
        <KpiCard
          label={t("alerts")}
          value={alerts.length}
          color={alerts.length > 0 ? "#DC2626" : "#16A34A"}
          icon={Warning}
          index={3}
        />
      </div>

      {/* Horizontal Bar Chart */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>{t("teamWorkload")}</SectionTitle>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="responsable" width={80} tick={{ fontSize: 11, fill: "var(--text-sub)" }} axisLine={false} tickLine={false} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value, name, props) => [value, t("totalDocs")]}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={24}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={getBarColor(entry, avgLoad, stdDev)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-16 text-sm text-text-muted">{t("noData")}</p>
        )}
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 8, justifyContent: "center" }}>
          {[
            { color: "#16A34A", label: t("normal") },
            { color: "#D97706", label: `> ${t("avgLoad")}` },
            { color: "#DC2626", label: t("overloaded") },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: item.color }} />
              <span className="text-text-muted" style={{ fontSize: 10 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Cards */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>{t("rptPerformanceByResp") || "Detalle por miembro"}</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {members.map((m, i) => {
            const statusColor = getWorkloadColor(m);
            const statusLabel = getStatusLabel(m, t);
            return (
              <motion.div
                key={m.responsable}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border"
                style={{
                  background: "var(--bg-page)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  borderColor: m.overload ? "#DC262660" : "var(--border)",
                  borderWidth: m.overload ? 2 : 1,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: RESP_COLORS[i % RESP_COLORS.length],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#FFF", fontSize: 11, fontWeight: 700,
                  }}>
                    {m.responsable.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{m.responsable}</span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    padding: "2px 6px", borderRadius: 4,
                    background: `${statusColor}18`, color: statusColor,
                    textTransform: "uppercase",
                  }}>
                    {statusLabel}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${m.pct}%`,
                    background: m.pct >= 75 ? "#16A34A" : m.pct >= 50 ? "#D97706" : "#DC2626",
                    borderRadius: 2,
                  }} />
                </div>

                {/* Stats */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-text-muted">Total</span>
                    <span className="text-text-main" style={{ fontWeight: 700 }}>{m.total}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-text-muted">% {t("completed")}</span>
                    <span style={{ fontWeight: 700, color: m.pct >= 75 ? "#16A34A" : m.pct >= 50 ? "#D97706" : "#DC2626" }}>
                      {m.pct}%
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-text-muted">{t("devolutions")}</span>
                    <span className="text-text-main" style={{ fontWeight: 700 }}>{m.devoluciones}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-text-muted">{t("thRateDevol") || "Tasa dev."}</span>
                    <span style={{ fontWeight: 700, color: (m.tasa_devolucion ?? 0) > 30 ? "#DC2626" : (m.tasa_devolucion ?? 0) > 15 ? "#D97706" : "#16A34A" }}>
                      {m.tasa_devolucion ?? 0}%
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-text-muted">{t("thCriticals") || "Criticos"}</span>
                    <span style={{ fontWeight: 700, color: (m.criticos ?? 0) > 0 ? "#DC2626" : "var(--text-muted)" }}>
                      {m.criticos ?? 0}
                    </span>
                  </div>
                  {m.velocidad_media > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-text-muted">{t("slaDays")}</span>
                      <span className="text-text-main" style={{ fontWeight: 700 }}>{m.velocidad_media}d</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
