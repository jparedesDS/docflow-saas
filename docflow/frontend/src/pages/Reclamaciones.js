import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import TopLoadingBar from "../components/TopLoadingBar";
import { ArrowClockwise, CheckCircle, Warning, FileText, ClockCounterClockwise, ShieldWarning, Megaphone } from "@phosphor-icons/react";
import Button from "../components/ui/Button";
import { CLAIM_STATUS_COLORS as STATUS_COLORS } from "../constants/status";
import { diffDaysFromNow } from "../utils/dates";
import { useI18n } from "../contexts/I18nContext";

function getStatusStyle(status) {
  return STATUS_COLORS[status] || { bg: "var(--bg-hover)", text: "var(--text-muted)", border: "var(--border)", dot: "var(--text-muted)" };
}

const URGENCY = {
  high:   { color: "#DC2626", label: ">60 dias" },
  medium: { color: "#D97706", label: ">30 dias" },
  low:    { color: "#CA8A04", label: ">15 dias" },
};

const ESCALATION = {
  1: { color: "#2563EB", bg: "#2563EB18", border: "#2563EB40", icon: Megaphone, labelKey: "reminder" },
  2: { color: "#D97706", bg: "#D9770618", border: "#D9770640", icon: Warning, labelKey: "formalClaim" },
  3: { color: "#DC2626", bg: "#DC262618", border: "#DC262640", icon: ShieldWarning, labelKey: "escalation" },
};

function validateEmails(str) {
  return str.split(/[;,]/).map(s => s.trim()).filter(Boolean)
    .filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-2">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} height={64} />)}
      </div>
      <div className="lg:col-span-2">
        <SkeletonCard height={320} />
      </div>
    </div>
  );
}

export default function Reclamaciones() {
  const { t } = useI18n();
  const [pedidos, setPedidos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedPedido, setSelected]   = useState(null);
  const [preview, setPreview]           = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError]               = useState(null);
  const [history, setHistory]           = useState(null);
  const [historyOpen, setHistoryOpen]   = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [toField, setToField]       = useState("");
  const [ccField, setCcField]       = useState("");
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const invalidTo = validateEmails(toField);
  const invalidCc = validateEmails(ccField);

  useEffect(() => { loadPedidos(); }, []);

  const loadPedidos = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get("/claims/claimable-with-levels");
      setPedidos(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Error cargando reclamaciones");
    }
    setLoading(false);
  };

  const loadPreview = async (pedido) => {
    setSelected(pedido); setPreviewLoading(true); setPreview(null); setSendResult(null);
    setHistory(null); setHistoryOpen(false);
    try {
      const [previewRes, historyRes] = await Promise.all([
        api.get(`/claims/${encodeURIComponent(pedido)}/preview`),
        api.get(`/claims/${encodeURIComponent(pedido)}/history`),
      ]);
      setPreview(previewRes.data);
      setToField((previewRes.data.suggested_to || []).join("; "));
      setCcField((previewRes.data.suggested_cc || []).join("; "));
      setHistory(historyRes.data);
    } catch (err) {
      setPreview({ error: err.response?.data?.detail || "Error cargando preview" });
    }
    setPreviewLoading(false);
  };

  const selectedEscalation = pedidos.find(p => p.pedido === selectedPedido)?.escalation_level || 1;
  const escalationStyle = ESCALATION[selectedEscalation] || ESCALATION[1];

  const handleSend = async () => {
    setSending(true); setSendResult(null);
    try {
      const res = await api.post(`/claims/${encodeURIComponent(selectedPedido)}/send-escalated`, {
        level: selectedEscalation,
      });
      setSendResult({ success: true, data: res.data });
      setShowModal(false);
      const nowIso = new Date().toISOString();
      setPedidos(prev => prev.map(p =>
        p.pedido === selectedPedido ? { ...p, last_claimed: nowIso } : p
      ));
      setHistory(prev => prev ? {
        ...prev,
        count: prev.count + 1,
        entries: [...prev.entries, {
          sent_at: nowIso,
          to: res.data.to,
          cc: res.data.cc,
          docs_count: res.data.docs_count,
          level: res.data.level,
        }],
      } : null);
      setPreview(null); setSelected(null);
    } catch (err) {
      setSendResult({ success: false, error: err.response?.data?.detail || "Error enviando" });
    }
    setSending(false);
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
    <TopLoadingBar loading={previewLoading || sending} />
    <PageHeader title={t("claimTitle")} description={t("claimDesc")} />
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: "calc(100vh - 260px)" }}>

      {/* --- Panel izquierdo: lista pedidos --- */}
      <div className="bg-card rounded-xl border border-border" style={{
        gridColumn: "span 1",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{t("claimPendingOrders")}</h3>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10,
              background: "#DC262618", color: "#DC2626", border: "1px solid #DC262640",
            }}>
              {pedidos.length}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={loadPedidos} title="Refrescar"
            className="text-text-muted" style={{ padding: 6, borderRadius: 6, background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}>
            <ArrowClockwise size={16} />
          </motion.button>
        </div>

        {error && (
          <div style={{ padding: 12, background: "#DC262618", color: "#DC2626", fontSize: 13, margin: 8, borderRadius: 6, border: "1px solid #DC262640" }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto" }}>
          {pedidos.length === 0 && !error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-text-muted" style={{ textAlign: "center", padding: 40 }}>
              <CheckCircle size={40} color="var(--border)" style={{ margin: "0 auto 8px", display: "block" }} />
              <p style={{ fontSize: 13 }}>{t("claimNoPending")}</p>
            </motion.div>
          )}
          <motion.div
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden" animate="visible">
            {pedidos.map((p) => {
              const urg = URGENCY[p.urgency] || URGENCY.low;
              const isSelected = selectedPedido === p.pedido;
              const diff = diffDaysFromNow(p.last_claimed);
              return (
                <motion.div
                  key={p.pedido}
                  variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
                  whileHover={{ x: 2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  onClick={() => loadPreview(p.pedido)}
                  style={{
                    padding: "10px 12px", cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    borderLeft: `3px solid ${urg.color}`,
                    background: isSelected ? "var(--accent)0F" : "transparent",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={ev => { if (!isSelected) ev.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={ev => { if (!isSelected) ev.currentTarget.style.background = "transparent"; }}>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{p.pedido}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {diff === 0 && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 10, background: "#D9770618", color: "#D97706", border: "1px solid #D9770640" }}>HOY</span>
                      )}
                      {diff !== null && diff >= 1 && diff < 7 && (
                        <span className="text-text-muted" style={{ fontSize: 9 }}>hace {diff}d</span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: urg.color + "18", color: urg.color, border: `1px solid ${urg.color}40` }}>
                        {p.docs_count} doc{p.docs_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {p.cliente && <span className="text-text-muted" style={{ fontSize: 10 }}>{p.cliente}</span>}
                    {p.po && <span className="text-text-muted" style={{ fontSize: 10, fontFamily: "monospace" }}>PO: {p.po}</span>}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: urg.color }}>
                      Max. {p.max_dias} {t("claimMaxDaysNoResponse")}
                    </span>
                    {p.last_claimed && diff !== null && diff >= 7 && (
                      <span className="text-text-muted" style={{ fontSize: 9 }}>
                        Reclamado {new Date(p.last_claimed).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </div>
                  {/* Escalation level badge */}
                  {p.escalation_level && (
                    <div style={{ marginTop: 4 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                        background: (ESCALATION[p.escalation_level] || ESCALATION[1]).bg,
                        color: (ESCALATION[p.escalation_level] || ESCALATION[1]).color,
                        border: `1px solid ${(ESCALATION[p.escalation_level] || ESCALATION[1]).border}`,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                      }}>
                        {t("escalationLevel")} {p.escalation_level}: {t((ESCALATION[p.escalation_level] || ESCALATION[1]).labelKey)}
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* --- Panel derecho: preview email --- */}
      <div className="lg:col-span-3 bg-card rounded-xl border border-border" style={{
        gridColumn: "span 3",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}>

        {/* Estado vacio */}
        {!selectedPedido && !sendResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="text-text-muted" style={{ textAlign: "center" }}>
              <svg style={{ width: 56, height: 56, margin: "0 auto 12px", display: "block", color: "var(--border)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p style={{ fontSize: 13 }}>{t("claimSelectOrder")}</p>
            </div>
          </motion.div>
        )}

        {/* Cargando */}
        {previewLoading && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="text-text-muted" style={{ textAlign: "center", fontSize: 13 }}>
              <div style={{ width: 32, height: 32, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
              {t("claimGenerating")}
            </div>
          </div>
        )}

        {/* Resultado envio */}
        {sendResult && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            style={{ margin: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="rounded-lg" style={{
              padding: 16,
              background: sendResult.success ? "#16A34A18" : "#DC262618",
              color: sendResult.success ? "#16A34A" : "#DC2626",
              border: `1px solid ${sendResult.success ? "#16A34A40" : "#DC262640"}`,
              fontSize: 13, fontWeight: 600,
            }}>
              {sendResult.success
                ? `Reclamacion enviada -- ${sendResult.data.docs_count} documento${sendResult.data.docs_count !== 1 ? "s" : ""}. Asunto: ${sendResult.data.subject}`
                : `Error: ${sendResult.error}`}
            </div>
            {sendResult.success && sendResult.data.saved_path && (
              <div className="rounded-lg" style={{
                padding: "8px 12px",
                background: "#3B82F618", color: "#3B82F6",
                border: "1px solid #3B82F640", fontSize: 11,
              }}>
                Guardado en: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                  {sendResult.data.saved_path.split(/[\\/]/).slice(-2).join("\\")}
                </span>
              </div>
            )}
            {sendResult.success && !sendResult.data.saved_path && !sendResult.data.save_error && (
              <div className="rounded-lg" style={{
                padding: "8px 12px",
                background: "#D9770618", color: "#D97706",
                border: "1px solid #D9770640", fontSize: 11,
              }}>
                No se encontro la carpeta del pedido en M:\
              </div>
            )}
            {sendResult.success && sendResult.data.save_error && (
              <div className="rounded-lg" style={{
                padding: "8px 12px",
                background: "#DC262618", color: "#DC2626",
                border: "1px solid #DC262640", fontSize: 11,
              }}>
                No se pudo guardar en disco: {sendResult.data.save_error}
              </div>
            )}
          </motion.div>
        )}

        {/* Preview */}
        {preview && !previewLoading && !preview.error && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

            {/* Cabecera */}
            <div style={{ padding: "16px 16px", borderBottom: "1px solid var(--border)", borderLeft: `4px solid ${escalationStyle.color}` }}>
              <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
                      {preview.pedido}
                    </h3>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 4,
                      background: escalationStyle.bg, color: escalationStyle.color,
                      border: `1px solid ${escalationStyle.border}`,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {t("escalationLevel")} {selectedEscalation}: {t(escalationStyle.labelKey)}
                    </span>
                  </div>
                  <p className="text-text-muted" style={{ fontSize: 11, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {preview.subject}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
                    {preview.po && (
                      <span className="text-text-muted" style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px",
                        borderRadius: 999, border: "1px solid var(--border)",
                        background: "var(--bg-input)", fontFamily: "monospace",
                      }}>
                        PO: {preview.po}
                      </span>
                    )}
                    {preview.cliente && (
                      <span className="text-text-muted" style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px",
                        borderRadius: 999, border: "1px solid var(--border)",
                        background: "var(--bg-input)",
                      }}>
                        {preview.cliente}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant={selectedEscalation >= 3 ? "danger" : selectedEscalation >= 2 ? "warning" : "primary"}
                  icon={escalationStyle.icon}
                  onClick={() => setShowModal(true)}
                >
                  {t("sendEscalated")}
                </Button>
              </div>
            </div>

            {/* Tabla documentos */}
            <div style={{ flex: 1, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr>
                    {["Order No.", "PO No.", "Client Doc. No.", "EIPSA Doc. No.", "Title", "Status", "Rev.", "Sent Date", "Return Days"].map(col => (
                      <th key={col} className="text-text-muted" style={{
                        background: "var(--bg-sidebar)",
                        padding: "8px 12px", fontWeight: 600, fontSize: 10,
                        letterSpacing: "0.04em", textTransform: "uppercase",
                        borderRight: "1px solid var(--border)", whiteSpace: "nowrap", textAlign: "center",
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.table_rows.map((row, i) => {
                    const daysAlert = typeof row.return_days === "number" && row.return_days > 0;
                    const sc = getStatusStyle(row.status);
                    return (
                      <tr key={i}
                        style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)", borderBottom: "1px solid var(--border)", transition: "background 0.12s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)"}>
                        <td className="text-text-sub" style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{row.order_no}</td>
                        <td className="text-text-sub" style={{ padding: "6px 10px", whiteSpace: "nowrap", fontFamily: "monospace" }}>{row.po_no}</td>
                        <td className="text-text-sub" style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{row.client_doc_no || "--"}</td>
                        <td className="text-text-sub" style={{ padding: "6px 10px", whiteSpace: "nowrap", fontFamily: "monospace" }}>{row.eipsa_doc_no}</td>
                        <td className="text-text-sub" style={{ padding: "6px 10px", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</td>
                        <td style={{ padding: "6px 10px", whiteSpace: "nowrap", textAlign: "center" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
                            borderRadius: 4, fontSize: 10, fontWeight: 700,
                            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                            {row.status}
                          </span>
                        </td>
                        <td className="text-text-sub" style={{ padding: "6px 10px", textAlign: "center" }}>{row.revision || "--"}</td>
                        <td className="text-text-muted" style={{ padding: "6px 10px", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                          {row.sent_date || "--"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                          {daysAlert
                            ? <span style={{ fontWeight: 700, color: "#DC2626", background: "#DC262618", borderRadius: 4, padding: "2px 6px", fontSize: 10 }}>{row.return_days}</span>
                            : <span className="text-text-muted">{row.return_days !== "" ? row.return_days : "--"}</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Historial acordeon */}
            {history && history.count > 0 && (
              <div style={{ borderTop: "1px solid var(--border)" }}>
                <div className="rounded-lg" style={{ margin: "8px 16px", background: "var(--bg-input)", padding: "12px 14px" }}>
                  <button
                    onClick={() => setHistoryOpen(v => !v)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center",
                      gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0,
                    }}>
                    <ClockCounterClockwise size={14} weight="bold" style={{ color: "var(--accent)" }} />
                    <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Reclamado {history.count} {history.count === 1 ? t("claimClaimedTimes") : t("claimClaimedTimesPlural")}
                    </span>
                    <svg style={{ width: 12, height: 12, transform: historyOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", marginLeft: "auto", color: "var(--text-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                  {historyOpen && (
                    <div className="relative" style={{ paddingLeft: 14, marginTop: 10 }}>
                      {history.entries.length > 1 && (
                        <div style={{
                          position: "absolute", left: 3, top: 4, bottom: 4, width: 2,
                          background: "var(--border)", borderRadius: 1,
                        }} />
                      )}
                      {[...history.entries].reverse().map((entry, i) => {
                        const entryLevel = entry.level || 1;
                        const entryEsc = ESCALATION[entryLevel] || ESCALATION[1];
                        return (
                          <div key={i} className="relative flex items-center gap-3" style={{ paddingBottom: i < history.entries.length - 1 ? 12 : 0 }}>
                            <div style={{
                              position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
                              width: 8, height: 8, borderRadius: "50%",
                              backgroundColor: entryEsc.color,
                              boxShadow: `0 0 0 3px ${entryEsc.color}25`,
                            }} />
                            <span className="text-text-main" style={{ fontSize: 11, fontWeight: 600 }}>
                              {new Date(entry.sent_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </span>
                            <span style={{
                              fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 3,
                              background: entryEsc.bg, color: entryEsc.color,
                              border: `1px solid ${entryEsc.border}`,
                              textTransform: "uppercase",
                            }}>
                              L{entryLevel}
                            </span>
                            <span className="text-text-muted" style={{ fontSize: 11 }}>{entry.docs_count} docs</span>
                            <span className="text-text-muted" style={{ fontSize: 10, fontFamily: "monospace" }}>
                              -> {(entry.to || []).join(", ")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-page)", display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={14} weight="bold" style={{ color: "var(--accent)" }} />
              <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {preview.docs_count} {t("claimDocsPending")}
              </span>
            </div>
          </div>
        )}

        {/* Error preview */}
        {preview?.error && (
          <div style={{ padding: 20, color: "#DC2626", fontSize: 13 }}>
            Error: {preview.error}
          </div>
        )}
      </div>

      {/* --- Modal reclamacion --- */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
            onClick={() => setShowModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="card"
              style={{
                padding: 24, width: 520,
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
              }}
              onClick={e => e.stopPropagation()}>

              <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                {t("sendEscalated")}
              </h3>
              <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                {t("claimSendDesc")}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Escalation level indicator */}
                <div className="rounded-lg" style={{
                  padding: 12, fontSize: 13,
                  background: escalationStyle.bg,
                  border: `1px solid ${escalationStyle.border}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {React.createElement(escalationStyle.icon, { size: 16, weight: "bold", style: { color: escalationStyle.color } })}
                    <span style={{ fontWeight: 800, color: escalationStyle.color, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {t("escalationLevel")} {selectedEscalation}: {t(escalationStyle.labelKey)}
                    </span>
                  </div>
                  <p className="text-text-muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
                    {selectedEscalation === 1 && t("escalationDesc1")}
                    {selectedEscalation === 2 && t("escalationDesc2")}
                    {selectedEscalation === 3 && t("escalationDesc3")}
                  </p>
                </div>

                {preview && (
                  <div className="rounded-lg" style={{ background: escalationStyle.bg, padding: 12, fontSize: 13, border: `1px solid ${escalationStyle.border}` }}>
                    <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{t("claimSubjectPreview")}</p>
                    <p style={{ color: escalationStyle.color, fontWeight: 700 }}>{preview.subject}</p>
                    <p className="text-text-muted" style={{ marginTop: 4 }}>
                      {preview.docs_count} {t("claimDocsSentNoReply")}
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  variant={selectedEscalation >= 3 ? "danger" : selectedEscalation >= 2 ? "warning" : "primary"}
                  icon={escalationStyle.icon}
                  onClick={handleSend}
                  disabled={sending}
                  loading={sending}
                >
                  {sending ? t("claimSending") : t("sendEscalated")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
