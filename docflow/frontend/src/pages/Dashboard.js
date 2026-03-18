import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import {
  Briefcase, FolderOpen, EnvelopeSimple, Database,
  CheckCircle as HealthCheck, XCircle, ArrowClockwise,
} from "@phosphor-icons/react";
import api from "../services/api";
import KpiCard from "../components/ui/KpiCard";
import SectionTitle from "../components/ui/SectionTitle";
import SkeletonCard from "../components/SkeletonCard";
import { useI18n } from "../contexts/I18nContext";
import { useTheme } from "../contexts/ThemeContext";
import TopLoadingBar from "../components/TopLoadingBar";
import { DASHBOARD_COLORS as STATUS_COLORS } from "../constants/status";
import { timeAgo } from "../utils/dates";

export default function Dashboard({ onNavigate }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [monitoring, setMonitoring] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get("/reports/monitoring-report"),
      api.get("/analytics/summary"),
      api.get("/notifications/?limit=6"),
    ]).then(([monRes, anaRes, notRes]) => {
      if (monRes.status === "fulfilled") setMonitoring(monRes.value.data);
      if (anaRes.status === "fulfilled") setAnalytics(anaRes.value.data);
      if (notRes.status === "fulfilled") setNotifications(notRes.value.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        <TopLoadingBar loading={true} />
        <SkeletonCard style={{ height: 60 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} style={{ height: 100 }} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
          <SkeletonCard style={{ height: 300 }} />
          <SkeletonCard style={{ height: 300 }} />
        </div>
      </div>
    );
  }

  const kpis = monitoring?.kpis || {};
  const porCliente = (analytics?.por_cliente || []).slice(0, 5);
  const porResp = (analytics?.por_responsable_doc || []).slice(0, 8);
  const notifList = Array.isArray(notifications) ? notifications.slice(0, 6) : [];

  // Funnel data
  const funnelData = [
    { name: t("notSent"), value: kpis.sin_enviar || 0, color: STATUS_COLORS.sin_enviar },
    { name: t("sent"), value: kpis.enviados || 0, color: STATUS_COLORS.enviados },
    { name: t("devolutions"), value: kpis.devoluciones || 0, color: STATUS_COLORS.devoluciones },
    { name: t("approved"), value: kpis.aprobados || 0, color: STATUS_COLORS.aprobados },
  ];

  const tooltipStyle = {
    contentStyle: {
      fontSize: 12, borderRadius: 8,
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border)",
      color: "var(--text-main)",
    },
  };

  const user = JSON.parse(localStorage.getItem("docflow_user") || "{}");
  const greeting = new Date().getHours() < 12 ? t("goodMorning") : new Date().getHours() < 18 ? t("goodAfternoon") : t("goodEvening");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
    >
      {/* Row 1: Welcome banner */}
      <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 className="text-text-main" style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            {greeting}, {user.name?.split(" ")[0] || "Usuario"}
          </h2>
          <p className="text-text-muted" style={{ fontSize: 12, marginTop: 2 }}>
            {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="text-text-muted" style={{ fontSize: 11 }}>
          {kpis.total || 0} {t("docsInSystem")}
        </div>
      </div>

      {/* Row 2: 4 KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <KpiCard label={t("totalDocs")} value={kpis.total || 0} color="var(--accent)" index={0} />
        <KpiCard label={t("completed")} value={`${kpis.pct_completado || 0}%`} color="#16A34A" index={1} />
        <KpiCard label={t("urgentDocs")} value={analytics?.docs_riesgo ?? 0} color="#DC2626" index={2} />
        <KpiCard label={t("slaDays")} value={`${analytics?.velocidad_media_dias ?? 0}d`} color="#D97706" index={3} />
      </div>

      {/* Row 3: Funnel + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        {/* Funnel chart */}
        <div className="card p-5">
          <SectionTitle>{t("docFlow")}</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {funnelData.map((item, i) => {
              const maxVal = Math.max(...funnelData.map(d => d.value), 1);
              const pct = (item.value / maxVal) * 100;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span className="text-text-sub" style={{ fontSize: 12, width: 80, textAlign: "right", flexShrink: 0 }}>
                    {item.name}
                  </span>
                  <div style={{ flex: 1, height: 28, borderRadius: 6, overflow: "hidden", background: "var(--bg-hover)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        height: "100%", borderRadius: 6,
                        background: item.color,
                        display: "flex", alignItems: "center", justifyContent: "flex-end",
                        paddingRight: 8,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#FFF" }}>
                        {item.value}
                      </span>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            {funnelData.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                <span className="text-text-muted" style={{ fontSize: 10 }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="card p-5">
          <SectionTitle>{t("activityRecent")}</SectionTitle>
          {notifList.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {notifList.map((notif, i) => {
                const colorMap = { reclamacion: "#D97706", exportacion: "#4F46E5", email: "#16A34A", transmittal: "#0D9488" };
                const accentColor = colorMap[notif.tipo] || "#64748B";
                return (
                  <motion.div
                    key={notif.id || i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-3 py-3"
                    style={{ borderBottom: i < notifList.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div
                      className="shrink-0 w-2 h-2 rounded-full mt-1.5"
                      style={{ backgroundColor: accentColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>
                        {notif.titulo}
                      </p>
                      {notif.detalle && (
                        <p className="text-text-muted" style={{ fontSize: 11, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {notif.detalle}
                        </p>
                      )}
                    </div>
                    <span className="text-text-muted font-mono" style={{ fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {timeAgo(notif.timestamp)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-sm text-text-muted">{t("noData")}</p>
          )}
        </div>
      </div>

      {/* Row 4: Top clients + Team workload */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Top clients bar */}
        <div className="card p-5">
          <SectionTitle>{t("topClients")}</SectionTitle>
          {porCliente.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porCliente} layout="vertical" margin={{ left: 0, right: 8 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: isDark ? "#64748B" : "#94A3B8" }} />
                <YAxis type="category" dataKey="cliente" tick={{ fontSize: 10, fill: isDark ? "#94A3B8" : "#475569" }} width={100} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={16}>
                  {porCliente.map((_, i) => <Cell key={i} fill="var(--accent)" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-12 text-sm text-text-muted">{t("noData")}</p>
          )}
        </div>

        {/* Team workload stacked */}
        <div className="card p-5">
          <SectionTitle>{t("teamWorkload")}</SectionTitle>
          {porResp.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {porResp.map(r => {
                const total = r.total || 1;
                const segments = [
                  { key: "aprobados", val: r.aprobados || 0, color: "#16A34A" },
                  { key: "devoluciones", val: r.devoluciones || 0, color: "#D97706" },
                  { key: "sin_enviar", val: r.sin_enviar ?? 0, color: "#64748B" },
                ];
                return (
                  <div key={r.responsable} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="text-text-sub" style={{ width: 70, fontSize: 11, fontWeight: 600, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.responsable}
                    </div>
                    <div style={{ flex: 1, display: "flex", height: 14, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                      {segments.map(s => s.val > 0 && (
                        <div key={s.key} style={{ flex: s.val / total, background: s.color, minWidth: 2 }} title={`${s.key}: ${s.val}`} />
                      ))}
                    </div>
                    <span className="text-text-muted" style={{ fontSize: 10, minWidth: 24, textAlign: "right" }}>{total}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                {[["#16A34A",t("dashApproved")],["#D97706",t("dashDevolution")],["#64748B",t("dashNotSent")]].map(([color, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                    <span className="text-text-muted" style={{ fontSize: 10 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center py-12 text-sm text-text-muted">{t("noData")}</p>
          )}
        </div>
      </div>

      {/* Row 5: Quick access + System health */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Quick access — clickable */}
        <div className="card p-5">
          <SectionTitle>{t("quickAccess")}</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: Briefcase, label: t("dashProjects"), desc: t("dashProjectsDesc"), color: "#4F46E5", section: "proyectos" },
              { icon: FolderOpen, label: t("dashDocuments"), desc: t("dashDocsDesc"), color: "#0D9488", section: "documentos" },
              { icon: EnvelopeSimple, label: t("dashComms"), desc: t("dashCommsDesc"), color: "#D97706", section: "comunicaciones" },
              { icon: Database, label: t("dashErp"), desc: t("dashErpDesc"), color: "#2563EB", section: "erp" },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => onNavigate?.(item.section)}
                className="rounded-lg border border-border text-left"
                style={{
                  padding: 12, display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", background: "transparent",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: `${item.color}14`, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <item.icon size={16} style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-text-main" style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</p>
                  <p className="text-text-muted" style={{ fontSize: 10 }}>{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* System health */}
        <SystemHealthWidget />
      </div>
    </motion.div>
  );
}

/* ── System health widget ── */
function SystemHealthWidget() {
  const { t } = useI18n();
  const [health, setHealth] = useState(null);
  const [polling, setPolling] = useState(null);

  useEffect(() => {
    api.get("/health/").then(r => setHealth(r.data)).catch(() => {});
    api.get("/polling/status").then(r => setPolling(r.data)).catch(() => {});
  }, []);

  const HealthRow = ({ label, ok, detail }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      {ok ? <HealthCheck size={14} weight="fill" style={{ color: "#16A34A" }} /> : <XCircle size={14} weight="fill" style={{ color: "#DC2626" }} />}
      <span className="text-text-sub" style={{ fontSize: 12, flex: 1 }}>{label}</span>
      <span className="text-text-muted" style={{ fontSize: 11 }}>{detail}</span>
    </div>
  );

  return (
    <div className="card p-5">
      <SectionTitle>{t("systemHealth")}</SectionTitle>
      {!health ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 16 }}>
          <ArrowClockwise size={14} className="text-text-muted" />
          <span className="text-text-muted" style={{ fontSize: 12 }}>{t("checking")}</span>
        </div>
      ) : (
        <div>
          <HealthRow label="API" ok={health.status === "ok"} detail={health.uptime || "—"} />
          <HealthRow label="Polling IMAP" ok={!!polling && !polling.error} detail={polling?.last_run || t("never")} />
          <HealthRow label="Archivos Excel" ok={health.status === "ok"} detail={health.excel_files ? `${Object.keys(health.excel_files).length} archivos` : "—"} />
        </div>
      )}
    </div>
  );
}
