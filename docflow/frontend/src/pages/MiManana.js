import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sun, Warning, Clock, EnvelopeSimple, ArrowRight,
  CheckCircle, FileText, Megaphone, SealWarning,
} from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import KpiCard from "../components/ui/KpiCard";
import SectionTitle from "../components/ui/SectionTitle";
import SkeletonCard from "../components/SkeletonCard";
import StatusBadge from "../components/StatusBadge";
import { formatDate } from "../utils/dates";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

function UrgencyBadge({ urgency }) {
  const { t } = useI18n();
  const config = {
    high:        { bg: "#DC262618", color: "#DC2626", label: t("mmUrgencyHigh") },
    medium:      { bg: "#D9770618", color: "#D97706", label: t("mmUrgencyMedium") },
    approaching: { bg: "#2563EB18", color: "#2563EB", label: t("mmApproaching") },
    low:         { bg: "var(--bg-hover)", color: "var(--text-muted)", label: t("mmUrgencyLow") },
  };
  const c = config[urgency] || config.low;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
      backgroundColor: c.bg, color: c.color,
    }}>
      {c.label}
    </span>
  );
}

export default function MiManana({ onNavigate }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("docflow_user") || "{}");

  useEffect(() => {
    api.get("/my-morning/")
      .then((res) => {
        setData(res.data);
      })
      .catch(() => {
        showToast(t("mmLoadError"), "error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonCard style={{ height: 72 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} style={{ height: 100 }} />)}
        </div>
        <SkeletonCard style={{ height: 200 }} />
        <SkeletonCard style={{ height: 200 }} />
      </div>
    );
  }

  const kpis = data?.summary_kpis || {};
  const returned = data?.returned_docs || [];
  const slaCritical = data?.sla_critical || [];
  const claims = data?.pending_claims || [];
  const nombre = data?.user?.nombre || user.name || "";
  const firstName = nombre.split(" ")[0] || t("mmUser");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("goodMorning") : hour < 18 ? t("goodAfternoon") : t("goodEvening");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* Header: greeting + date */}
      <motion.div variants={itemVariants} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, var(--accent), #818CF8)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sun size={20} weight="bold" color="#FFF" />
          </div>
          <div>
            <h2 className="text-text-main" style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
              {greeting}, {firstName}
            </h2>
            <p className="text-text-muted" style={{ fontSize: 12, marginTop: 2 }}>
              {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11 }} className="text-text-muted">
          {returned.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <EnvelopeSimple size={14} weight="bold" color="#D97706" />
              {returned.length} {t("mmReturnedCount")}
            </span>
          )}
          {slaCritical.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Warning size={14} weight="bold" color="#DC2626" />
              {slaCritical.length} {t("mmSlaCount")}
            </span>
          )}
        </div>
      </motion.div>

      {/* KPIs row */}
      <motion.div variants={itemVariants} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <KpiCard
          label={t("mmMyDocs")}
          value={kpis.total || 0}
          color="var(--accent)"
          icon={FileText}
          index={0}
          sub={`${kpis.pct_aprobados || 0}% ${t("approved").toLowerCase()}`}
        />
        <KpiCard
          label={t("mmApprovedDocs")}
          value={kpis.aprobados || 0}
          color="#16A34A"
          icon={CheckCircle}
          index={1}
          sub={`${t("mmTeamAverage")}: ${kpis.team_pct || 0}%`}
        />
        <KpiCard
          label={t("mmCriticalDocs")}
          value={kpis.criticos || 0}
          color="#DC2626"
          icon={SealWarning}
          index={2}
        />
        <KpiCard
          label={t("mmPendingSend")}
          value={kpis.sin_enviar || 0}
          color="#D97706"
          icon={Clock}
          index={3}
        />
      </motion.div>

      {/* Section: Returned docs (devolutions) */}
      <motion.div variants={itemVariants} className="card p-5">
        <SectionTitle>{t("mmReturnedToday")} ({returned.length})</SectionTitle>
        {returned.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <EnvelopeSimple size={40} weight="thin" color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
            <p className="text-text-muted" style={{ fontSize: 13 }}>{t("mmNoReturnedDocs")}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
            {returned.map((doc, i) => (
              <motion.div
                key={doc.doc_eipsa || i}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="rounded-lg border border-border"
                style={{
                  padding: "14px 16px",
                  backgroundColor: "var(--bg-page)",
                  cursor: "pointer",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(99,102,241,0.10)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                onClick={() => onNavigate && onNavigate("documentos")}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "var(--accent)" }}>
                    {doc.doc_eipsa}
                  </span>
                  <StatusBadge status={doc.estado} />
                </div>
                <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px", lineHeight: 1.3 }}>
                  {doc.titulo || t("mmNoTitle")}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <span className="text-text-muted" style={{ fontSize: 11 }}>
                    {doc.cliente} {doc.pedido && `\u00b7 ${doc.pedido}`}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                    {t("mmViewInDocs")} <ArrowRight size={12} weight="bold" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Section: SLA Critical */}
      <motion.div variants={itemVariants} className="card p-5">
        <SectionTitle>{t("mmSlaCritical")} ({slaCritical.length})</SectionTitle>
        {slaCritical.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Warning size={40} weight="thin" color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
            <p className="text-text-muted" style={{ fontSize: 13 }}>{t("mmNoSlaCritical")}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {[t("docEipsa"), t("mmTitle"), t("client"), t("days"), t("status"), t("mmUrgency")].map((h) => (
                    <th key={h} className="text-text-muted" style={{
                      padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--border)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slaCritical.map((doc, i) => (
                  <tr
                    key={doc.doc_eipsa || i}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    onClick={() => onNavigate && onNavigate("documentos")}
                  >
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 600, color: "var(--accent)" }}>
                      {doc.doc_eipsa}
                    </td>
                    <td className="text-text-main" style={{ padding: "10px 12px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.titulo || "-"}
                    </td>
                    <td className="text-text-muted" style={{ padding: "10px 12px" }}>
                      {doc.cliente}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        fontWeight: 700,
                        color: doc.urgency === "high" ? "#DC2626" : doc.urgency === "medium" ? "#D97706" : "#2563EB",
                      }}>
                        {doc.dias_devolucion}d
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <StatusBadge status={doc.estado} />
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <UrgencyBadge urgency={doc.urgency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Section: Pending Claims */}
      <motion.div variants={itemVariants} className="card p-5">
        <SectionTitle>{t("mmPendingClaims")} ({claims.length})</SectionTitle>
        {claims.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <Megaphone size={40} weight="thin" color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
            <p className="text-text-muted" style={{ fontSize: 13 }}>{t("mmNoPendingClaims")}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {claims.map((claim, i) => (
              <motion.div
                key={claim.pedido || i}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="rounded-lg border border-border"
                style={{
                  padding: "14px 16px",
                  backgroundColor: "var(--bg-page)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
                    {claim.pedido}
                  </span>
                  <UrgencyBadge urgency={claim.urgency} />
                </div>
                <p className="text-text-muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
                  {claim.cliente}
                  {claim.docs_count != null && ` \u00b7 ${claim.docs_count} docs`}
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="text-text-muted" style={{ fontSize: 11 }}>
                    {claim.max_dias} {t("mmDaysWaiting")}
                    {claim.last_claimed && (
                      <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>
                        ({t("mmLastClaimed")}: {formatDate(claim.last_claimed)})
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => onNavigate && onNavigate("comunicaciones")}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: "1px solid var(--accent)",
                      backgroundColor: "transparent",
                      color: "var(--accent)",
                      cursor: "pointer",
                      transition: "background-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--accent)";
                      e.currentTarget.style.color = "#FFF";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "var(--accent)";
                    }}
                  >
                    <Megaphone size={12} weight="bold" />
                    {t("mmSendClaim")}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
