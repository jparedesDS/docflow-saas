import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import TopLoadingBar from "../components/TopLoadingBar";
import { ArrowClockwise, PaperPlaneTilt, FileText } from "@phosphor-icons/react";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { STATUS_COLORS } from "../constants/status";
import { useI18n } from "../contexts/I18nContext";

function getStatusStyle(status) {
  const n = (status || "").toLowerCase().trim().replace(/[\s.]+/g, "_");
  if (STATUS_COLORS[n]) return STATUS_COLORS[n];
  for (const [key, style] of Object.entries(STATUS_COLORS)) {
    if (n.includes(key) || key.includes(n)) return style;
  }
  return { bg: "var(--bg-hover)", text: "var(--text-muted)", dot: "var(--text-muted)", border: "var(--border)" };
}

const PLATFORM_COLORS = {
  "TÉCNICAS REUNIDAS": { bg: "#7C3AED18", text: "#7C3AED", border: "#7C3AED40" },
  ACONEX:          { bg: "#2563EB18", text: "#2563EB", border: "#2563EB40" },
  SENDOC:          { bg: "#16A34A18", text: "#16A34A", border: "#16A34A40" },
  GAIA:            { bg: "#D9770618", text: "#D97706", border: "#D9770640" },
  "DOCUMENT SPACE": { bg: "#DB277718", text: "#DB2777", border: "#DB277740" },
  UNKNOWN:         { bg: "var(--bg-hover)", text: "var(--text-muted)", border: "var(--border)" },
};

const STATUS_OPTIONS = ["", "Aprobado", "Com. Menores", "Com. Mayores", "Rechazado", "Informativo"];

function validateEmails(str) {
  return str.split(/[;,]/).map(s => s.trim()).filter(Boolean)
    .filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export default function Devoluciones() {
  const { t } = useI18n();
  const [emails, setEmails]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedUid, setSelectedUid]     = useState(null);
  const [preview, setPreview]             = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError]                 = useState(null);

  const [docStatuses, setDocStatuses] = useState({});

  const [showModal, setShowModal]   = useState(false);
  const [toField, setToField]       = useState("");
  const [ccField, setCcField]       = useState("");
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const invalidTo = validateEmails(toField);
  const invalidCc = validateEmails(ccField);

  useEffect(() => { loadEmails(); }, []);

  const loadEmails = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get("/transmittals/emails");
      setEmails(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Error conectando al buzón");
    }
    setLoading(false);
  };

  const loadPreview = async (uid) => {
    setSelectedUid(uid); setPreviewLoading(true); setPreview(null); setSendResult(null); setDocStatuses({});
    try {
      const res = await api.get(`/transmittals/emails/${uid}/preview`);
      setPreview(res.data);
      setToField((res.data.suggested_to || []).join("; "));
      setCcField((res.data.suggested_cc || []).join("; "));
    } catch (err) {
      setPreview({ error: err.response?.data?.detail || "Error parseando email" });
    }
    setPreviewLoading(false);
  };

  const handleProcess = async () => {
    setSending(true); setSendResult(null);
    try {
      const to = toField.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      const cc = ccField.split(/[;,]/).map(s => s.trim()).filter(Boolean);
      const res = await api.post(`/transmittals/emails/${selectedUid}/process`, { to, cc, status_overrides: docStatuses });
      setSendResult({ success: true, data: res.data });
      setShowModal(false);
      setEmails(prev => prev.map(e =>
        e.uid === selectedUid ? { ...e, processed: true } : e
      ));
      setPreview(null); setSelectedUid(null);
    } catch (err) {
      setSendResult({ success: false, error: err.response?.data?.detail || "Error procesando" });
    }
    setSending(false);
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
    <TopLoadingBar loading={previewLoading || sending} />
    <PageHeader title="Devoluciones" description="Gestión automática de devoluciones de transmittals" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "calc(100vh - 260px)" }}>

      {/* ─── Panel izquierdo: lista emails ─── */}
      <div className="card" style={{
        gridColumn: "span 1",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{t('eaBandeja')}</h3>
            <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "#2563EB18", color: "#2563EB", border: "1px solid #2563EB40" }}>
              {emails.length}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={loadEmails} title="Refrescar"
            className="text-text-muted"
            style={{ padding: 6, borderRadius: 6, background: "none", border: "none", cursor: "pointer" }}
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
          {emails.length === 0 && !error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-text-muted"
              style={{ textAlign: "center", padding: 40, fontSize: 13 }}>
              No hay emails pendientes
            </motion.div>
          )}
          <motion.div
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden" animate="visible">
            {emails.map((e) => {
              const pc = PLATFORM_COLORS[e.platform] || PLATFORM_COLORS.UNKNOWN;
              const isSelected = selectedUid === e.uid;
              return (
                <motion.div
                  key={e.uid}
                  variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}
                  whileHover={{ x: 2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  onClick={() => loadPreview(e.uid)}
                  style={{
                    padding: "10px 12px", cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    borderLeft: `3px solid ${pc.text}`,
                    background: isSelected ? "var(--accent)0F" : "transparent",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={ev => { if (!isSelected) ev.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={ev => { if (!isSelected) ev.currentTarget.style.background = "transparent"; }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
                      {e.platform}
                    </span>
                    <span className="text-text-muted" style={{ fontSize: 10 }}>
                      {e.date ? new Date(e.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : ""}
                    </span>
                  </div>
                  <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.subject}
                  </p>
                  {e.processed && (
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      background: "#16A34A18", color: "#16A34A",
                      borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 600,
                    }}>
                      Enviado
                    </span>
                  )}
                  {!e.parseable && (
                    <span style={{ fontSize: 9, color: "#D97706", fontWeight: 600 }}>Plataforma no reconocida</span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </div>

      {/* ─── Panel derecho: preview ─── */}
      <div className="card lg:col-span-2" style={{
        gridColumn: "span 2",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>

        {/* Estado vacío */}
        {!selectedUid && !sendResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="text-text-muted" style={{ textAlign: "center" }}>
              <svg style={{ width: 56, height: 56, margin: "0 auto 12px", display: "block", color: "var(--border)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <p style={{ fontSize: 13 }}>Selecciona un email para ver la documentación</p>
            </div>
          </motion.div>
        )}

        {/* Cargando */}
        {previewLoading && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="text-text-muted" style={{ textAlign: "center", fontSize: 13 }}>
              <div style={{ width: 32, height: 32, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
              {t('eaReadingEmail')}
            </div>
          </div>
        )}

        {/* Resultado envío */}
        {sendResult && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg"
            style={{
              margin: 20, padding: 16,
              background: sendResult.success ? "#16A34A18" : "#DC262618",
              color: sendResult.success ? "#16A34A" : "#DC2626",
              border: `1px solid ${sendResult.success ? "#16A34A40" : "#DC262640"}`,
              fontSize: 13, fontWeight: 600,
            }}>
            {sendResult.success ? (
              <div>
                <div>{`Notificación enviada correctamente — ${sendResult.data.documents_count} documento${sendResult.data.documents_count !== 1 ? "s" : ""}. Asunto: ${sendResult.data.subject}`}</div>
                {sendResult.data.saved_path && (
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 400, color: "#3B82F6" }}>
                    {`✓ Guardado en: .../${sendResult.data.saved_path.split(/[\\/]/).slice(-2).join("/")}`}
                  </div>
                )}
                {!sendResult.data.saved_path && !sendResult.data.save_error && (
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 400, color: "#D97706" }}>
                    ⚠ No se encontró la carpeta del pedido en M:\
                  </div>
                )}
                {sendResult.data.save_error && (
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 400, color: "#DC2626" }}>
                    {`⚠ No se pudo guardar en disco: ${sendResult.data.save_error}`}
                  </div>
                )}
              </div>
            ) : `Error: ${sendResult.error}`}
          </motion.div>
        )}

        {/* Preview */}
        {preview && !previewLoading && !preview.error && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

            {/* Cabecera del email */}
            <div style={{ padding: "16px 16px", borderBottom: "1px solid var(--border)", borderLeft: "4px solid var(--accent, #4F46E5)" }}>
              <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {preview.documents[0]?.["Nº Pedido"] && (
                    <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
                      {preview.documents[0]["Nº Pedido"]}
                    </h3>
                  )}
                  <p className="text-text-muted" style={{ fontSize: 11, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {preview.subject}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
                    <Badge label={preview.platform} color={(PLATFORM_COLORS[preview.platform] || PLATFORM_COLORS.UNKNOWN).text} variant="solid" />
                    {preview.documents[0]?.["Cliente"] && (
                      <span className="text-text-muted" style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px",
                        borderRadius: 999, border: "1px solid var(--border)",
                        background: "var(--bg-input)",
                      }}>
                        {preview.documents[0]["Cliente"]}
                      </span>
                    )}
                    {preview.documents[0]?.["Material"] && (
                      <span className="text-text-muted" style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px",
                        borderRadius: 999, border: "1px solid var(--border)",
                        background: "var(--bg-input)",
                      }}>
                        {preview.documents[0]["Material"]}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="primary" icon={PaperPlaneTilt} onClick={() => setShowModal(true)}>
                  {t('eaNotify')}
                </Button>
              </div>
            </div>

            {/* Tabla documentos */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr style={{ background: "var(--bg-sidebar)" }}>
                    {["Doc. Cliente", "Título", "Rev.", "Estado"].map(col => (
                      <th key={col} className="text-text-muted" style={{
                        padding: "8px 12px", fontWeight: 700, fontSize: 10,
                        letterSpacing: "0.04em", textTransform: "uppercase",
                        borderRight: "1px solid var(--border)", whiteSpace: "nowrap", textAlign: "left",
                        minWidth: col === "Título" ? 280 : col === "Doc. Cliente" ? 160 : col === "Rev." ? 48 : 120,
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.documents.map((doc, i) => {
                    const sc = getStatusStyle(doc["Estado"]);
                    return (
                      <tr key={i}
                        style={{ background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)", borderBottom: "1px solid var(--border)", transition: "background 0.12s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)"}>
                        <td className="text-text-sub" style={{ padding: "7px 12px", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 11 }}>
                          {doc["Doc. Cliente"] || "—"}
                        </td>
                        <td className="text-text-sub" style={{ padding: "7px 12px", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          title={doc["Título"] || ""}>
                          {doc["Título"] || "—"}
                        </td>
                        <td className="text-text-muted" style={{ padding: "7px 12px", textAlign: "center", fontWeight: 600 }}>
                          {doc["Rev."] || "—"}
                        </td>
                        <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>
                          {["ACONEX", "DOCUMENT SPACE"].includes(preview.platform) ? (
                            <select
                              value={docStatuses[i] ?? ""}
                              onChange={e => setDocStatuses(prev => ({ ...prev, [i]: e.target.value }))}
                              className="input-field"
                              style={{ fontSize: 11, padding: "3px 6px", width: "auto" }}>
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || `— ${t('eaNoStatus')} —`}</option>)}
                            </select>
                          ) : (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                              background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                              {doc["Estado"] || "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer con totales */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-page)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <FileText size={14} weight="bold" style={{ color: "var(--accent)" }} />
              <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {preview.documents.length} documento{preview.documents.length !== 1 ? "s" : ""}
              </span>
              {Object.entries(
                preview.documents.reduce((acc, d) => { acc[d["Estado"]] = (acc[d["Estado"]] || 0) + 1; return acc; }, {})
              ).map(([estado, count]) => (
                <Badge key={estado} status={estado} label={`${count} ${estado}`} variant="dot" />
              ))}
            </div>
          </div>
        )}

        {/* Error preview */}
        {preview?.error && (() => {
          const isWarning = /not recognized|no documents|no readable/i.test(preview.error);
          return (
            <div className="rounded-lg" style={{
              padding: 20, margin: 16, fontSize: 13,
              color: isWarning ? "#D97706" : "#DC2626",
              background: isWarning ? "#D9770618" : "#DC262618",
              border: `1px solid ${isWarning ? "#D9770640" : "#DC262640"}`,
            }}>
              {preview.error}
            </div>
          );
        })()}
      </div>

      {/* ─── Modal notificación ─── */}
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
                Enviar notificación de devolución
              </h3>
              <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Se enviará un email profesional con el estado de la documentación recibida.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Para (To)</label>
                  <input type="text" value={toField} onChange={e => setToField(e.target.value)}
                    className="input-field"
                    style={invalidTo.length > 0 ? { borderColor: "#CA8A04" } : undefined}
                    placeholder="email@eipsa.es; email2@eipsa.es" />
                  {invalidTo.length > 0 && (
                    <div style={{ marginTop: 4, padding: "6px 10px", background: "#CA8A0418", border: "1px solid #CA8A0440", borderRadius: 6, fontSize: 11, color: "#CA8A04" }}>
                      Dirección invalida: {invalidTo.join(", ")}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>CC</label>
                  <input type="text" value={ccField} onChange={e => setCcField(e.target.value)}
                    className="input-field"
                    style={invalidCc.length > 0 ? { borderColor: "#CA8A04" } : undefined}
                    placeholder="cc@eipsa.es" />
                  {invalidCc.length > 0 && (
                    <div style={{ marginTop: 4, padding: "6px 10px", background: "#CA8A0418", border: "1px solid #CA8A0440", borderRadius: 6, fontSize: 11, color: "#CA8A04" }}>
                      CC invalido: {invalidCc.join(", ")}
                    </div>
                  )}
                </div>

                {preview && (
                  <div className="border border-border rounded-lg" style={{ background: "var(--bg-page)", padding: 12, fontSize: 13 }}>
                    <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Vista previa del asunto</p>
                    <p className="text-text-main" style={{ fontWeight: 600 }}>
                      DEV: {preview.documents[0]?.["Nº Pedido"] || ""} [{preview.transmittal_code || preview.subject}]
                    </p>
                    <p className="text-text-muted" style={{ marginTop: 4 }}>
                      {preview.documents.length} documento{preview.documents.length !== 1 ? "s" : ""} · Plazo: 15 días
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  icon={PaperPlaneTilt}
                  onClick={handleProcess}
                  disabled={sending || invalidTo.length > 0}
                  loading={sending}
                >
                  {sending ? "Enviando..." : "Enviar notificación"}
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

/* ─── Skeleton ─── */
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
