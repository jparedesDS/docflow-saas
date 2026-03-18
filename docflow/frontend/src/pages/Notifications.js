import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import { ArrowClockwise, Bell, Export, Gear } from "@phosphor-icons/react";
import { useI18n } from "../contexts/I18nContext";

function getTipoConfig(t) {
  return {
    reclamacion: { label: t("claimTitle"), color: "#DC2626", bg: "#DC262618" },
    exportacion: { label: t("export"),     color: "#16A34A", bg: "#16A34A18" },
    sistema:     { label: "Sistema",       color: "#2563EB", bg: "#2563EB18" },
  };
}

function getConfig(tipo, tipoConfig) {
  return tipoConfig[tipo] || tipoConfig.sistema;
}

function formatTimestamp(ts, t) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  if (diffMin < 1) return t ? t("notifNow") : "Ahora";
  if (diffMin < 60) return t ? t("notifMinAgo").replace("{min}", diffMin) : `Hace ${diffMin}min`;
  if (diffH < 24) return t ? t("notifHoursAgo").replace("{h}", diffH) : `Hace ${diffH}h`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TIPO_ICON = { reclamacion: Bell, exportacion: Export, sistema: Gear };

const listItem = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

function RegistroTab({ notifications, stats, loading, filterTipo, setFilterTipo, loadData, t }) {
  const TIPO_CONFIG = getTipoConfig(t);
  const filtered = filterTipo ? notifications.filter(n => n.tipo === filterTipo) : notifications;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <SkeletonCard key={i} height={72} />)}
        </div>
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} height={60} />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div
        variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
        initial="hidden" animate="visible"
        className="grid grid-cols-3 gap-3">
        <StatCard label={t("notifTotalActions")} value={stats.total} color="#2563EB" />
        <StatCard label={t("notifToday")} value={stats.hoy} color="#16A34A" />
        <StatCard label={t("notifClaims")} value={stats.por_tipo?.reclamacion || 0} color="#DC2626" />
      </motion.div>

      {/* Filter row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="text-text-muted" style={{ fontSize: 11, fontWeight: 600 }}>{t("notifFilterBy")}</span>
        <FilterChip label={t("notifAll")} active={!filterTipo} onClick={() => setFilterTipo(null)} />
        {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
          <FilterChip key={key} label={cfg.label} active={filterTipo === key}
            color={cfg.color} onClick={() => setFilterTipo(filterTipo === key ? null : key)} />
        ))}
        <div style={{ flex: 1 }} />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={loadData}
          className="bg-card border border-border text-text-sub"
          style={{
            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}>
          <ArrowClockwise size={12} />
          {t("update")}
        </motion.button>
      </div>

      <div className="bg-card border border-border" style={{
        borderRadius: 10, overflow: "hidden",
      }}>
        {filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: 48, textAlign: "center" }}>
            <Bell size={36} color="var(--border)" style={{ margin: "0 auto 12px", display: "block" }} />
            <p className="text-text-muted" style={{ fontSize: 13 }}>{t("notifNone")}</p>
            <p className="text-text-muted" style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>{t("notifNoClaimsRegistered")}</p>
          </motion.div>
        ) : (
          <motion.div variants={{ visible: { transition: { staggerChildren: 0.04 } } }} initial="hidden" animate="visible">
            {filtered.map((n, i) => {
              const cfg = getConfig(n.tipo, TIPO_CONFIG);
              const Icon = TIPO_ICON[n.tipo] || Gear;
              return (
                <motion.div key={n.id || i} variants={listItem}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.12s", cursor: "default",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = ""}>
                  <div className="rounded-lg" style={{
                    width: 36, height: 36, backgroundColor: cfg.bg,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={18} color={cfg.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{n.titulo}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                        backgroundColor: cfg.bg, color: cfg.color, textTransform: "uppercase",
                      }}>{cfg.label}</span>
                    </div>
                    {n.detalle && (
                      <p className="text-text-muted" style={{ fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.detalle}</p>
                    )}
                  </div>
                  <span className="text-text-muted" style={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }}>{formatTimestamp(n.timestamp, t)}</span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function AlertasTab({ t }) {
  const [dias, setDias] = useState(15);
  const [destinatario, setDestinatario] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [urgencias, setUrgencias] = useState([]);
  const [loadingU, setLoadingU] = useState(true);

  useEffect(() => {
    api.get("/analytics/summary")
      .then(r => setUrgencias(r.data.urgencias || []))
      .catch(() => {})
      .finally(() => setLoadingU(false));
  }, []);

  const elegibles = urgencias.filter(u => u.dias >= dias);

  const enviar = async () => {
    const emails = destinatario.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    if (!emails.length) { setResult({ error: "Ingresa al menos un destinatario" }); return; }
    setSending(true); setResult(null);
    try {
      const res = await api.post("/analytics/alerts/send", { dias_umbral: dias, destinatarios: emails });
      setResult(res.data);
    } catch (e) { setResult({ error: e.message }); }
    finally { setSending(false); }
  };

  if (loadingU) return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => <SkeletonCard key={i} height={60} />)}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("notifTotalUrgencies")} value={urgencias.length} color="#2563EB" />
        <StatCard label={t("notifWithDays").replace("{dias}", dias)} value={elegibles.length} color="#DC2626" />
        <StatCard label={t("notifCriticalPending")} value={urgencias.filter(u => u.critico).length} color="#D97706" />
      </div>

      {/* Configuración */}
      <div className="bg-card border border-border" style={{
        borderRadius: 10, padding: 16,
      }}>
        <p className="text-text-main" style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t("notifConfigureAlert")}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label className="text-text-muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>{t("notifDaysThreshold")}</label>
            <input type="number" min={1} value={dias} onChange={e => setDias(Number(e.target.value))}
              className="text-text-main border border-border"
              style={{
                width: 70, padding: "6px 10px", borderRadius: 6,
                fontSize: 13, background: "var(--bg-input, var(--bg-page))", outline: "none",
              }} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="text-text-muted" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>{t("notifRecipients")}</label>
            <input type="text" value={destinatario} onChange={e => setDestinatario(e.target.value)}
              placeholder="email@eipsa.es, otro@eipsa.es"
              className="text-text-main border border-border"
              style={{
                width: "100%", padding: "6px 10px", borderRadius: 6,
                fontSize: 13, boxSizing: "border-box", background: "var(--bg-input, var(--bg-page))",
                outline: "none",
              }} />
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={enviar} disabled={sending}
            className="rounded-lg"
            style={{
              padding: "7px 18px", background: sending ? "var(--text-muted)" : "var(--accent)",
              color: "#FFF", border: "none", cursor: sending ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600,
            }}>
            {sending ? "Enviando..." : `Enviar alerta (${elegibles.length} docs)`}
          </motion.button>
        </div>
        {result && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600,
              background: result.error ? "#DC262618" : result.sent ? "#16A34A18" : "#CA8A0418",
              color: result.error ? "#DC2626" : result.sent ? "#16A34A" : "#CA8A04",
              border: `1px solid ${result.error ? "#DC262640" : result.sent ? "#16A34A40" : "#CA8A0440"}`,
            }}>
            {result.error ? `Error: ${result.error}` : result.sent ? `Alerta enviada — ${result.count} documentos incluidos` : result.message}
          </motion.div>
        )}
      </div>

      {/* Lista de documentos elegibles */}
      {elegibles.length > 0 && (
        <div>
          <p className="text-text-muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
            {t("notifDocsInAlert")}
          </p>
          <motion.div
            variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            initial="hidden" animate="visible"
            style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {elegibles.map((u, i) => {
              const semaforo = u.dias > 30 ? "#DC2626" : u.dias > 15 ? "#D97706" : "#2563EB";
              return (
                <motion.div key={i} variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
                  className="bg-card border border-border"
                  style={{
                    display: "grid", gridTemplateColumns: "10px 1fr auto",
                    gap: 10, padding: "8px 12px",
                    borderRadius: 6,
                    alignItems: "center",
                  }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: semaforo }} />
                  <div>
                    <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{u.doc_eipsa || u.pedido}</span>
                    {u.critico && <span style={{ fontSize: 9, background: "#DC262620", color: "#DC2626", padding: "1px 5px", borderRadius: 4, fontWeight: 700, marginLeft: 6 }}>CRITICO</span>}
                    <p className="text-text-muted" style={{ fontSize: 11, margin: "2px 0 0" }}>{u.titulo} · {u.cliente} · {u.estado}</p>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: semaforo }}>{u.dias}d</span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {elegibles.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: "center", padding: "32px 0", color: "#16A34A" }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>{t("notifNoDocsExceed").replace("{dias}", dias)}</p>
        </motion.div>
      )}
    </div>
  );
}

export default function Notifications() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ total: 0, hoy: 0, por_tipo: {} });
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState(null);
  const [activeTab, setActiveTab] = useState("registro");

  const loadData = async () => {
    setLoading(true);
    try {
      const [notRes, statsRes] = await Promise.all([
        api.get("/notifications/"),
        api.get("/notifications/stats"),
      ]);
      setNotifications(notRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Error cargando notificaciones:", err);
      showToast("Error al cargar notificaciones", "error");
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  const TABS = [
    { key: "registro", label: t("notifActionLog") },
    { key: "alertas",  label: t("notifDocflowAlerts") },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title={t("notifTitle")} description={t("notifDesc")} />
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 0, position: "relative" }}>
        {TABS.map(tab => (
          <div key={tab.key} style={{ position: "relative" }}>
            <button
              onClick={() => setActiveTab(tab.key)}
              style={{
                fontSize: 13, fontWeight: 600, padding: "8px 18px", cursor: "pointer",
                border: "none", background: "none",
                color: activeTab === tab.key ? "var(--text-main)" : "var(--text-muted)",
                transition: "color 0.15s",
                position: "relative", zIndex: 1,
              }}>
              {tab.label}
            </button>
            {activeTab === tab.key && (
              <motion.div
                layoutId="tab-indicator"
                style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: 2,
                  background: "var(--accent)", borderRadius: 2,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "registro" && (
          <motion.div key="registro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <RegistroTab
              notifications={notifications} stats={stats} loading={loading}
              filterTipo={filterTipo} setFilterTipo={setFilterTipo} loadData={loadData}
              t={t}
            />
          </motion.div>
        )}
        {activeTab === "alertas" && (
          <motion.div key="alertas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <AlertasTab t={t} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Auxiliares ── */

function StatCard({ label, value, color }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
      whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}
      className="bg-card border border-border"
      style={{
        borderRadius: 10,
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        position: "relative", overflow: "hidden",
      }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div className="rounded-lg" style={{
        width: 36, height: 36, backgroundColor: color + "18",
        border: `1px solid ${color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color, fontWeight: 800, fontSize: 14,
      }}>{value}</div>
      <span className="text-text-sub" style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
    </motion.div>
  );
}

function FilterChip({ label, active, color, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
        border: active ? "none" : "1px solid var(--border)",
        backgroundColor: active ? (color || "var(--accent)") : "var(--bg-card)",
        color: active ? "#FFF" : "var(--text-muted)",
        transition: "all 0.15s",
      }}>
      {label}
    </motion.button>
  );
}
