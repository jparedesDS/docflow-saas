import React from "react";
import { getStatusColor } from "../../constants/status";

/**
 * Badge component.
 * Usage:
 *   <Badge status="Aprobado" />                    — auto-color from status
 *   <Badge label="Custom" color="#3B82F6" />        — manual color
 *   <Badge status="Enviado" variant="pill" />       — pill variant
 *   <Badge status="Rechazado" variant="solid" />    — solid variant
 */
export default function Badge({ status, label, color, variant = "dot", colorMap }) {
  let display, s;
  if (colorMap && status && colorMap[status]) {
    const cm = colorMap[status];
    display = label || cm.label || status;
    s = { bg: cm.bg, text: cm.text, dot: cm.text, border: `${cm.text}40` };
  } else {
    display = label || ((!status || String(status).trim() === "") ? "Sin Enviar" : status);
    s = color ? { bg: `${color}18`, text: color, dot: color, border: `${color}40` } : getStatusColor(display);
  }
  const textColor = s.text || s.color;

  if (variant === "solid") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
        backgroundColor: textColor, color: "#FFF",
      }}>
        {display.toUpperCase()}
      </span>
    );
  }

  if (variant === "pill") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
        backgroundColor: s.bg, color: textColor,
      }}>
        {display.toUpperCase()}
      </span>
    );
  }

  // Default: dot variant
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
      backgroundColor: s.bg, color: textColor, border: `1px solid ${s.border || "transparent"}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: s.dot || textColor }} />
      {display.toUpperCase()}
    </span>
  );
}
