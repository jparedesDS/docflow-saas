import React, { lazy, Suspense, useState, useEffect } from "react";
import { motion } from "framer-motion";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import AnimatedNumber from "./AnimatedNumber";
import RiskIndicator from "./RiskIndicator";
import { formatDate } from "../utils/dates";
import { useI18n } from "../contexts/I18nContext";
import api from "../services/api";
import {
  X,
  IdentificationCard,
  FileText,
  ClockCountdown,
  ArrowsClockwise,
  CalendarBlank,
  ChatText,
  ClockCounterClockwise,
  Warning,
  Calendar,
  Flag,
  PaperPlaneTilt,
  Paperclip,
  ShieldCheck,
} from "@phosphor-icons/react";

const AuditTimeline = lazy(() => import("./AuditTimeline"));
const CommentThread = lazy(() => import("./CommentThread"));
const FileAttachments = lazy(() => import("./FileAttachments"));

/* ── Constantes ── */
const ID_FIELDS = ["Nº Pedido", "Cliente", "Nº PO", "Nº Oferta", "Material"];
const DOC_FIELDS = ["Tipo Doc.", "Info/Review", "Repsonsable", "Crítico", "Nº Doc. Cliente"];
const DATE_FIELDS = ["Fecha Pedido", "Fecha Prevista", "Fecha Env. Doc."];
const HISTORY_FIELDS = ["Historial Rev."];

const FULL_WIDTH = new Set(["Material", "Nº Doc. Cliente"]);

const TIMELINE_CONFIG = {
  "Fecha Pedido":    { color: "#6366F1", icon: Calendar,       labelKey: "ddOrderDate" },
  "Fecha Prevista":  { color: "#D97706", icon: Flag,           labelKey: "ddExpectedDate" },
  "Fecha Env. Doc.": { color: "#16A34A", icon: PaperPlaneTilt, labelKey: "ddSentDate" },
};

/* ── Helpers ── */
function hasValue(val) {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  return s !== "" && s !== "—" && s !== "-";
}

function formatFieldValue(val) {
  if (!hasValue(val)) return null;
  const s = String(val);
  if (s.includes("T") && s.includes("-") && s.length > 10) return s.split("T")[0];
  return s;
}

function formatDateValue(val) {
  if (!hasValue(val)) return null;
  return formatDate(val) || String(val);
}

function getDaysColor(days) {
  const n = parseFloat(days);
  if (isNaN(n)) return "var(--text-muted)";
  if (n < 30) return "#16A34A";
  if (n <= 90) return "#D97706";
  return "#DC2626";
}

/* ── Sub-components ── */
function MiniKpi({ icon: Icon, label, value, color }) {
  return (
    <div
      className="flex-1 flex flex-col items-center gap-1 rounded-lg"
      style={{ padding: "10px 6px", background: "var(--bg-input)" }}
    >
      <Icon size={16} weight="bold" style={{ color: color || "var(--accent)" }} />
      <span className="font-mono" style={{ fontSize: 20, fontWeight: 800, color: color || "var(--text-main)", lineHeight: 1 }}>
        <AnimatedNumber value={value} duration={600} />
      </span>
      <span className="text-text-muted" style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
    </div>
  );
}

function FieldCard({ label, value, fullWidth }) {
  return (
    <div
      className="rounded-md"
      style={{
        padding: "6px 10px",
        background: "var(--bg-page)",
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <span className="text-text-muted block" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span className="text-text-main block" style={{ fontSize: 13, fontWeight: 500, marginTop: 1, lineHeight: 1.35 }}>
        {value}
      </span>
    </div>
  );
}

function SectionBlock({ icon: Icon, title, children }) {
  return (
    <div className="rounded-lg" style={{ background: "var(--bg-input)", padding: "12px 14px", marginTop: 12 }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
        <Icon size={14} weight="bold" style={{ color: "var(--accent)" }} />
        <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── Classification levels ── */
const CLASSIFICATION_LEVELS = [
  { value: "public", color: "#16A34A", labelKey: "classPublic" },
  { value: "internal", color: "#2563EB", labelKey: "classInternal" },
  { value: "confidential", color: "#D97706", labelKey: "classConfidential" },
  { value: "restricted", color: "#DC2626", labelKey: "classRestricted" },
];

/* ── Componente principal ── */
export default function DocumentDetail({ document, onClose }) {
  const { t } = useI18n();
  const [classification, setClassification] = useState("internal");
  const [classLoading, setClassLoading] = useState(false);

  const docId = document ? (document["Nº Doc. EIPSA"] || document["Documento"] || "") : "";

  useEffect(() => {
    if (!docId) return;
    api.get(`/classification/${encodeURIComponent(docId)}`)
      .then(res => setClassification(res.data.level || "internal"))
      .catch(() => {});
  }, [docId]);

  const handleClassChange = async (newLevel) => {
    if (newLevel === classification) return;
    setClassLoading(true);
    try {
      await api.put(`/classification/${encodeURIComponent(docId)}`, { level: newLevel });
      setClassification(newLevel);
    } catch {}
    setClassLoading(false);
  };

  if (!document) return null;

  const title = document["Título"] || document["Titulo"] || "";
  const estado = document["Estado"] || "";
  const tipoDoc = document["Tipo Doc."] || "";
  const seguimiento = document["Seguimiento"] || "";

  // KPI values
  const revision = document["Nº Revisión"];
  const diasEnvio = document["Días Envío"];
  const diasDev = document["Días Devolución"];
  const hasKpis = hasValue(revision) || hasValue(diasEnvio) || hasValue(diasDev);

  // Filter fields with values
  const idFields = ID_FIELDS.filter((f) => hasValue(document[f]));
  const docFields = DOC_FIELDS.filter((f) => hasValue(document[f]));
  const visibleDates = DATE_FIELDS.filter((f) => hasValue(document[f]));
  const historial = HISTORY_FIELDS.map((f) => document[f]).find((v) => hasValue(v));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <motion.div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />

      {/* Panel */}
      <motion.div
        className="relative w-full max-w-md bg-card shadow-2xl flex flex-col"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      >
        {/* ── HEADER (sticky) ── */}
        <div
          className="sticky top-0 bg-card z-10 border-b border-border"
          style={{ padding: "16px 20px", borderLeft: "4px solid var(--accent, #4F46E5)" }}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              {hasValue(docId) && (
                <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
                  {String(docId)}
                </h3>
              )}
              {hasValue(title) && (
                <p className="text-text-muted" style={{ fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
                  {String(title)}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
                {hasValue(estado) && <Badge status={String(estado)} variant="pill" />}
                {hasValue(tipoDoc) && (
                  <span
                    className="text-text-muted"
                    style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px",
                      borderRadius: 999, border: "1px solid var(--border)",
                      background: "var(--bg-input)",
                    }}
                  >
                    {String(tipoDoc)}
                  </span>
                )}
                {/* Classification dropdown */}
                {(() => {
                  const cls = CLASSIFICATION_LEVELS.find(c => c.value === classification) || CLASSIFICATION_LEVELS[1];
                  return (
                    <select
                      value={classification}
                      onChange={e => handleClassChange(e.target.value)}
                      disabled={classLoading}
                      title={t("classLabel")}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px",
                        borderRadius: 999, border: `1px solid ${cls.color}40`,
                        background: `${cls.color}12`, color: cls.color,
                        cursor: classLoading ? "wait" : "pointer",
                        appearance: "none", WebkitAppearance: "none",
                        paddingRight: 16,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 2l4 4 4-4z' fill='${encodeURIComponent(cls.color)}'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 4px center",
                      }}
                    >
                      {CLASSIFICATION_LEVELS.map(c => (
                        <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                      ))}
                    </select>
                  );
                })()}
                {/* Risk indicator */}
                {docId && <RiskIndicator documentRef={docId} compact />}
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost p-1.5" style={{ marginLeft: 8 }}>
              <X size={16} weight="bold" className="text-text-muted" />
            </button>
          </div>
        </div>

        {/* ── BODY (scrollable) ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "8px 20px 16px" }}>
          {/* KPI row */}
          {hasKpis && (
            <div className="flex gap-2" style={{ marginTop: 12 }}>
              {hasValue(revision) && (
                <MiniKpi icon={ArrowsClockwise} label={t('ddRevision')} value={revision} color="var(--accent)" />
              )}
              {hasValue(diasEnvio) && (
                <MiniKpi
                  icon={ClockCountdown}
                  label={t('ddDaysSent')}
                  value={diasEnvio}
                  color={getDaysColor(diasEnvio)}
                />
              )}
              {hasValue(diasDev) && (
                <MiniKpi
                  icon={CalendarBlank}
                  label={t('ddDaysReturn')}
                  value={diasDev}
                  color={getDaysColor(diasDev)}
                />
              )}
            </div>
          )}

          {/* Identificación */}
          {idFields.length > 0 && (
            <SectionBlock icon={IdentificationCard} title={t('ddIdentification')}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {idFields.map((f) => (
                  <FieldCard
                    key={f}
                    label={f}
                    value={formatFieldValue(document[f])}
                    fullWidth={FULL_WIDTH.has(f)}
                  />
                ))}
              </div>
            </SectionBlock>
          )}

          {/* Documento */}
          {docFields.length > 0 && (
            <SectionBlock icon={FileText} title={t('ddDocument')}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {docFields.map((f) => (
                  <FieldCard
                    key={f}
                    label={f}
                    value={formatFieldValue(document[f])}
                    fullWidth={FULL_WIDTH.has(f)}
                  />
                ))}
              </div>
            </SectionBlock>
          )}

          {/* Timeline */}
          {visibleDates.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
                <Calendar size={14} weight="bold" style={{ color: "var(--accent)" }} />
                <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {t('ddDates')}
                </span>
              </div>
              <div className="relative" style={{ paddingLeft: 14 }}>
                {/* Connector line */}
                {visibleDates.length > 1 && (
                  <div
                    style={{
                      position: "absolute", left: 3, top: 4, bottom: 4, width: 2,
                      background: "var(--border)", borderRadius: 1,
                    }}
                  />
                )}
                {visibleDates.map((field, i) => {
                  const cfg = TIMELINE_CONFIG[field];
                  const Icon = cfg.icon;
                  return (
                    <div key={field} className="relative flex items-center gap-3" style={{ paddingBottom: i < visibleDates.length - 1 ? 14 : 0 }}>
                      {/* Dot with ring */}
                      <div
                        style={{
                          position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
                          width: 8, height: 8, borderRadius: "50%",
                          backgroundColor: cfg.color,
                          boxShadow: `0 0 0 3px ${cfg.color}25`,
                        }}
                      />
                      <Icon size={14} weight="bold" style={{ color: cfg.color, flexShrink: 0 }} />
                      <span className="text-text-muted" style={{ fontSize: 11, minWidth: 56 }}>{t(cfg.labelKey)}</span>
                      <span className="text-text-main font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                        {formatDateValue(document[field])}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seguimiento (destacado) */}
          {hasValue(seguimiento) && (
            <div
              className="rounded-lg flex gap-2.5"
              style={{
                marginTop: 12, padding: "12px 14px",
                background: "rgba(217,119,6,0.08)",
                borderLeft: "3px solid #D97706",
              }}
            >
              <ChatText size={16} weight="bold" style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }} />
              <div className="flex-1 min-w-0">
                <span className="text-text-muted block" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  {t('ddTracking')}
                </span>
                <p className="text-text-main" style={{ fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {String(seguimiento)}
                </p>
              </div>
            </div>
          )}

          {/* Historial */}
          {hasValue(historial) && (
            <div
              className="rounded-lg"
              style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg-input)" }}
            >
              <div className="flex items-center gap-1.5" style={{ marginBottom: 8 }}>
                <ClockCounterClockwise size={14} weight="bold" style={{ color: "var(--accent)" }} />
                <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {t('ddRevisionHistory')}
                </span>
              </div>
              <p className="text-text-main" style={{ fontSize: 12, lineHeight: 1.55, whiteSpace: "pre-line" }}>
                {String(historial)}
              </p>
            </div>
          )}

          {/* File Attachments */}
          {docId && (
            <Suspense fallback={null}>
              <div style={{ marginTop: 12 }}>
                <SectionBlock icon={Paperclip} title={t('ddAttachments')}>
                  <FileAttachments documentRef={docId} />
                </SectionBlock>
              </div>
            </Suspense>
          )}

          {/* Comments */}
          {docId && (
            <Suspense fallback={null}>
              <div style={{ marginTop: 12 }}>
                <SectionBlock icon={ChatText} title={t('ddComments')}>
                  <CommentThread documentRef={docId} />
                </SectionBlock>
              </div>
            </Suspense>
          )}

          {/* Audit Trail */}
          {docId && (
            <Suspense fallback={null}>
              <div style={{ marginTop: 12 }}>
                <SectionBlock icon={ClockCounterClockwise} title={t('ddAuditTrail')}>
                  <AuditTimeline documentRef={docId} />
                </SectionBlock>
              </div>
            </Suspense>
          )}
        </div>

        {/* ── FOOTER (sticky) ── */}
        <div className="border-t border-border" style={{ padding: "12px 20px" }}>
          <Button
            variant="danger"
            icon={Warning}
            className="w-full py-2.5"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("docflow:claim", { detail: document }));
              onClose();
            }}
          >
            {t('ddGenerateClaim')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
