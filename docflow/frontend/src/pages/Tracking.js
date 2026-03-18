import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import DocumentDetail from "../components/DocumentDetail";
import { ArrowClockwise, Tray } from "@phosphor-icons/react";
import { SUB_STATUS_COLORS } from "../constants/status";
import { diasDesde } from "../utils/dates";
import { useI18n } from "../contexts/I18nContext";

const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.05 } } };

function classifyStatus(status) {
  const n = (status || "").toLowerCase().trim().replace(/[\s.]+/g, "_");
  if (!n) return "sin_enviar";
  if (n.includes("eliminado")) return null;
  if (n.includes("aprobado")) return null;
  if (n.includes("com_menores") || n.includes("com__menores")) return "pendientes";
  if (n.includes("com_mayores") || n.includes("com__mayores")) return "pendientes";
  if (n.includes("comentado")) return "pendientes";
  if (n.includes("rechazado")) return "pendientes";
  if (n.includes("enviado")) return "enviado";
  return "sin_enviar";
}

function getSubStatusKey(status) {
  const n = (status || "").toLowerCase().trim().replace(/[\s.]+/g, "_");
  if (n.includes("rechazado")) return "rechazado";
  if (n.includes("com_menores") || n.includes("com__menores")) return "com_menores";
  if (n.includes("com_mayores") || n.includes("com__mayores")) return "com_mayores";
  if (n.includes("comentado")) return "comentado";
  return null;
}

function getDaysInStatus(doc) {
  const dateKeys = Object.keys(doc).filter(
    (k) => k.toLowerCase().includes("fecha") || k.toLowerCase().includes("date")
  );
  for (const key of dateKeys) {
    const val = doc[key];
    if (val) {
      const days = diasDesde(val);
      if (days !== null) return days;
    }
  }
  return null;
}

function getDaysColor(days) {
  if (days === null) return null;
  if (days > 14) return "#DC2626";
  if (days > 7) return "#D97706";
  return "#16A34A";
}

export default function Tracking() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const KANBAN_COLUMNS = useMemo(() => [
    { key: "pendientes",  label: t("trackingPending"),  color: "#D97706" },
    { key: "enviado",     label: t("trackingSent"),      color: "#2563EB" },
    { key: "sin_enviar",  label: t("trackingNotSent"),   color: "#64748B" },
  ], [t]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/documents/monitoring");
      setDocuments(res.data);
    } catch (err) {
      console.error("Error cargando documentos:", err);
      showToast("Error al cargar documentos", "error");
    }
    setLoading(false);
  };

  const getDocField = (doc, ...candidates) => {
    for (const c of candidates) {
      const key = Object.keys(doc).find((k) => k.toLowerCase().includes(c.toLowerCase()));
      if (key && doc[key]) return String(doc[key]);
    }
    return "";
  };

  const grouped = {};
  KANBAN_COLUMNS.forEach((col) => (grouped[col.key] = []));
  documents.forEach((doc) => {
    const status = getDocField(doc, "estado", "status") || "Sin Enviar";
    const bucket = classifyStatus(status);
    if (bucket && grouped[bucket]) grouped[bucket].push({ ...doc, _status: status });
  });

  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ height: 22, width: 120, borderRadius: 6, background: "var(--bg-hover)", marginBottom: 6 }} className="animate-pulse" />
            <div style={{ height: 12, width: 200, borderRadius: 4, background: "var(--bg-hover)" }} className="animate-pulse" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 1200, margin: "0 auto" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SkeletonCard height={40} />
              {[...Array(3)].map((_, j) => <SkeletonCard key={j} height={88} />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("trackingTitle")}
        description={t("trackingDesc")}
      >
        <span className="text-text-muted border border-border" style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "var(--bg-hover)" }}>
          {documents.length} {t("docs")}
        </span>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={loadData}
          className="btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <ArrowClockwise size={13} />
          {t("update")}
        </motion.button>
      </PageHeader>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignItems: "start", maxWidth: 1200, margin: "0 auto" }}>
        {KANBAN_COLUMNS.map((col) => (
          <div key={col.key}>
            {/* Column header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: 8, marginBottom: 8,
              background: col.color + "12",
              borderTop: `3px solid ${col.color}`,
              border: `1px solid ${col.color}30`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: col.color }}>{col.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 10,
                background: col.color + "20", color: col.color,
              }}>{grouped[col.key].length}</span>
            </div>

            {/* Cards con stagger */}
            <motion.div
              variants={stagger} initial="hidden" animate="visible"
              style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 260px)", overflowY: "auto", paddingRight: 2 }}>
              {grouped[col.key].map((doc, i) => {
                const docNum = getDocField(doc, "doc. eipsa", "doc", "documento", "codigo") || `#${i + 1}`;
                const client = getDocField(doc, "cliente");
                const responsible = getDocField(doc, "responsable", "asignado");
                const days = getDaysInStatus(doc);
                const daysColor = getDaysColor(days);
                return (
                  <motion.div
                    key={i}
                    variants={fadeUp}
                    whileHover={{ y: -3, boxShadow: "0 8px 20px rgba(0,0,0,0.18)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    onClick={() => setSelectedDoc(doc)}
                    className="bg-card border border-border rounded-lg"
                    style={{
                      borderLeft: `3px solid ${daysColor || col.color}`,
                      padding: 10,
                      cursor: "pointer",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                      <p className="text-text-main" style={{
                        fontSize: 11, fontWeight: 700,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, margin: 0,
                      }}>{docNum}</p>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {col.key === "en_revision" && (() => {
                          const subKey = getSubStatusKey(doc._status);
                          const subColor = SUB_STATUS_COLORS[subKey] || col.color;
                          const subLabels = { rechazado: t('rechazado'), com_menores: t('com_menores'), com_mayores: t('com_mayores'), comentado: t('comentado') };
                          return subKey ? (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                              background: subColor + "20", color: subColor, whiteSpace: "nowrap",
                            }}>{subLabels[subKey]}</span>
                          ) : null;
                        })()}
                        {days !== null && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                            background: daysColor + "20", color: daysColor, whiteSpace: "nowrap",
                          }}>{days}d</span>
                        )}
                      </div>
                    </div>
                    {client && (
                      <p className="text-text-muted" style={{ fontSize: 10, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {client}
                      </p>
                    )}
                    {responsible && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                        <div style={{
                          width: 15, height: 15, borderRadius: "50%",
                          background: col.color + "30",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 8, fontWeight: 800, color: col.color,
                        }}>{responsible.charAt(0).toUpperCase()}</div>
                        <span className="text-text-muted" style={{ fontSize: 9 }}>{responsible}</span>
                      </div>
                    )}

                  </motion.div>
                );
              })}

              {grouped[col.key].length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 12px" }}>
                  <Tray size={32} weight="thin" style={{ color: col.color, margin: "0 auto 8px", display: "block", opacity: 0.4 }} />
                  <p className="text-text-muted" style={{ fontSize: 11 }}>{t("trackingNoDocsInCol")}</p>
                </div>
              )}
            </motion.div>
          </div>
        ))}
      </div>

      <DocumentDetail document={selectedDoc} onClose={() => setSelectedDoc(null)} />
    </div>
  );
}
