import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePlus,
  PaperPlaneTilt,
  CheckCircle,
  Clock,
  ChatCircle,
  Warning,
  GitBranch,
  X,
} from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { getStatusColor } from "../constants/status";
import StatusBadge from "./StatusBadge";
import { formatDate } from "../utils/dates";

const EVENT_CONFIG = {
  created: {
    icon: FilePlus,
    color: "#2563EB",
    bg: "#2563EB18",
  },
  sent: {
    icon: PaperPlaneTilt,
    color: "#4F46E5",
    bg: "#4F46E518",
  },
  status: {
    icon: CheckCircle,
    color: "#16A34A",
    bg: "#16A34A18",
  },
  comment: {
    icon: ChatCircle,
    color: "#64748B",
    bg: "#64748B18",
  },
  claim: {
    icon: Warning,
    color: "#DC2626",
    bg: "#DC262618",
  },
  revision: {
    icon: GitBranch,
    color: "#7C3AED",
    bg: "#7C3AED18",
  },
};

function getEventConfig(event) {
  const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.status;

  // Override status color based on estado
  if (event.type === "status" && event.estado) {
    const statusColor = getStatusColor(event.estado);
    return {
      ...config,
      color: statusColor.color || config.color,
      bg: statusColor.bg || config.bg,
      icon: event.estado.toLowerCase() === "aprobado" ? CheckCircle : Clock,
    };
  }

  return config;
}

export default function DocTimeline({ docRef, onClose }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!docRef) return;
    setLoading(true);
    setError(null);
    api
      .get(`/predictions/timeline/${encodeURIComponent(docRef)}`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message || "Error loading timeline"))
      .finally(() => setLoading(false));
  }, [docRef]);

  if (loading) {
    return (
      <TimelineContainer onClose={onClose}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 200,
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          {t("loading") || "Cargando..."}
        </div>
      </TimelineContainer>
    );
  }

  if (error || !data) {
    return (
      <TimelineContainer onClose={onClose}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: 200,
            gap: 8,
            color: "var(--text-muted)",
          }}
        >
          <Warning size={28} weight="thin" />
          <span style={{ fontSize: 12 }}>
            {error || t("noData") || "Sin datos"}
          </span>
        </div>
      </TimelineContainer>
    );
  }

  const doc = data.document || {};
  const events = data.events || [];

  return (
    <TimelineContainer onClose={onClose}>
      {/* Document header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-hover)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span
            className="text-text-main"
            style={{ fontSize: 15, fontWeight: 800 }}
          >
            {data.doc_ref}
          </span>
          {doc.critico &&
            ["si", "yes", "true", "1", "x"].includes(
              String(doc.critico).toLowerCase().replace("í", "i")
            ) && (
              <span
                style={{
                  display: "inline-block",
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "#DC262618",
                  color: "#DC2626",
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {t("critical") || "CRÍTICO"}
              </span>
            )}
        </div>
        <div
          className="text-text-sub"
          style={{ fontSize: 12, lineHeight: 1.5 }}
        >
          {doc.titulo && <div>{doc.titulo}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
            {doc.cliente && (
              <span>
                <span className="text-text-muted">
                  {t("client") || "Cliente"}:
                </span>{" "}
                <strong>{doc.cliente}</strong>
              </span>
            )}
            {doc.pedido && (
              <span>
                <span className="text-text-muted">Pedido:</span>{" "}
                <strong>{doc.pedido}</strong>
              </span>
            )}
            {doc.responsable && (
              <span>
                <span className="text-text-muted">Resp.:</span>{" "}
                <strong>{doc.responsable}</strong>
              </span>
            )}
          </div>
          {doc.estado && (
            <div style={{ marginTop: 6 }}>
              <StatusBadge status={doc.estado} />
            </div>
          )}
        </div>
      </div>

      {/* Timeline events */}
      <div style={{ padding: "16px 20px" }}>
        {events.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 16px",
              gap: 8,
              color: "var(--text-muted)",
            }}
          >
            <Clock size={28} weight="thin" />
            <span style={{ fontSize: 12 }}>
              {t("noData") || "Sin eventos"}
            </span>
          </div>
        ) : (
          <div>
            {events.map((event, idx) => {
              const config = getEventConfig(event);
              const Icon = config.icon;
              const isLast = idx === events.length - 1;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08 }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    position: "relative",
                    paddingBottom: isLast ? 0 : 20,
                  }}
                >
                  {/* Vertical line */}
                  {!isLast && (
                    <div
                      style={{
                        position: "absolute",
                        left: 13,
                        top: 28,
                        bottom: 0,
                        width: 2,
                        background:
                          "linear-gradient(180deg, var(--border) 0%, transparent 100%)",
                      }}
                    />
                  )}

                  {/* Circle icon */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: config.bg,
                      border: `2px solid ${config.color}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={13} weight="bold" color={config.color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="text-text-main"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.4,
                      }}
                    >
                      {event.title}
                    </div>
                    {event.description && (
                      <div
                        className="text-text-muted"
                        style={{
                          fontSize: 11,
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {event.description}
                      </div>
                    )}
                  </div>

                  {/* Date badge */}
                  {event.date && (
                    <div
                      style={{
                        flexShrink: 0,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--bg-hover)",
                        border: "1px solid var(--border)",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(event.date)}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--border)",
          fontSize: 10,
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        {data.total_events}{" "}
        {data.total_events === 1 ? t("event") || "evento" : t("events") || "eventos"}
      </div>
    </TimelineContainer>
  );
}

function TimelineContainer({ children, onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 520,
            maxHeight: "80vh",
            overflowY: "auto",
            background: "var(--bg-card)",
            borderRadius: 12,
            border: "1px solid var(--border)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            position: "relative",
          }}
        >
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "1px solid var(--border)",
                background: "var(--bg-page)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 10,
                color: "var(--text-muted)",
              }}
            >
              <X size={14} />
            </button>
          )}
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

