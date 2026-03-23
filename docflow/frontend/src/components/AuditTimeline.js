import React, { useState, useEffect } from "react";
import {
  ClockCounterClockwise,
  PencilSimple,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { timeAgo } from "../utils/dates";

const ACTION_COLORS = {
  created: "#16A34A",
  updated: "#3B82F6",
  deleted: "#DC2626",
  status_changed: "#D97706",
};

const ACTION_ICONS = {
  created: Plus,
  updated: PencilSimple,
  deleted: Trash,
  status_changed: PencilSimple,
};

export default function AuditTimeline({ documentRef }) {
  const { t } = useI18n();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!documentRef) return;
    setLoading(true);
    api
      .get(`/audit/document/${encodeURIComponent(documentRef)}`)
      .then((res) => setEntries(res.data || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [documentRef]);

  if (loading) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>
        {t("loading") || "Cargando..."}
      </div>
    );
  }

  if (!entries.length) {
    return (
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
        <ClockCounterClockwise size={32} weight="thin" />
        <span style={{ fontSize: 12 }}>
          {t("auditNoHistory") || "Sin historial de cambios"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 12px" }}>
      {entries.map((entry, idx) => {
        const color = ACTION_COLORS[entry.action] || "#64748B";
        const Icon = ACTION_ICONS[entry.action] || PencilSimple;
        const isLast = idx === entries.length - 1;

        let description = entry.action || "update";
        if (entry.action === "status_changed" && entry.field) {
          description = `${entry.field} ${t("auditChangedFrom") || "changed from"} ${entry.old_value || "—"} ${t("auditTo") || "to"} ${entry.new_value || "—"}`;
        } else if (entry.action === "updated" && entry.field) {
          description = `${entry.field} ${t("auditUpdated") || "actualizado"}`;
        } else if (entry.action === "created") {
          description = t("auditCreated") || "Documento creado";
        } else if (entry.action === "deleted") {
          description = t("auditDeleted") || "Documento eliminado";
        }

        return (
          <div
            key={entry.id || idx}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              position: "relative",
              paddingBottom: isLast ? 0 : 14,
            }}
          >
            {/* Vertical line */}
            {!isLast && (
              <div
                style={{
                  position: "absolute",
                  left: 9,
                  top: 20,
                  bottom: 0,
                  width: 1,
                  background: "var(--border)",
                }}
              />
            )}

            {/* Dot */}
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: `${color}18`,
                border: `2px solid ${color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <Icon size={10} weight="bold" color={color} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-main)",
                  lineHeight: 1.4,
                  fontWeight: 500,
                }}
              >
                {description}
              </div>
              {entry.details && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  {entry.details}
                </div>
              )}
            </div>

            {/* Right: time + user */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                flexShrink: 0,
                gap: 2,
              }}
            >
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {timeAgo(entry.timestamp || entry.created_at)}
              </span>
              {entry.user_initials && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "var(--accent)",
                    background: "var(--accent-soft, rgba(79,70,229,0.07))",
                    padding: "1px 5px",
                    borderRadius: 4,
                  }}
                >
                  {entry.user_initials}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
