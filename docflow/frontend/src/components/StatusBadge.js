import React from "react";
import { getStatusColor } from "../constants/status";
import { useI18n } from "../contexts/I18nContext";

export default function StatusBadge({ status }) {
  const { t } = useI18n();
  const display = (!status || String(status).trim() === "") ? t('statusNotSent') : status;
  const s = getStatusColor(display);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
      backgroundColor: s.bg, color: s.text || s.color, border: `1px solid ${s.border || "transparent"}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: s.dot || s.color }} />
      {display.toUpperCase()}
    </span>
  );
}
