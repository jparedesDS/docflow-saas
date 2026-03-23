import React, { useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { motion } from "framer-motion";
import { ArrowSquareOut } from "@phosphor-icons/react";

const POPOVER_W = 320;
const POPOVER_H = 340;

function getHealthInfo(pct, t) {
  if (pct >= 75) return { label: t("sgOnTrack"),    color: "#16A34A" };
  if (pct >= 50) return { label: t("sgInProgress"), color: "#D97706" };
  if (pct >= 25) return { label: t("sgAttention"),  color: "#CA8A04" };
  return               { label: t("sgUrgent"),      color: "#DC2626" };
}

export default function ProjectPreviewPopover({ pedido, anchor, onNavigate, onMouseEnter, onMouseLeave, t }) {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const placeAbove = spaceBelow < POPOVER_H + 16;

  const style = useMemo(() => ({
    position: "fixed",
    left: Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_W - 16)),
    top: placeAbove ? rect.top - POPOVER_H - 8 : rect.bottom + 8,
    width: POPOVER_W,
    zIndex: 9999,
  }), [rect.left, rect.top, rect.bottom, placeAbove]);

  const pct = pedido.pct_completado ?? 0;
  const health = getHealthInfo(pct, t);

  // Close on scroll / resize
  useEffect(() => {
    const close = () => onMouseLeave();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onMouseLeave]);

  const breakdownItems = [
    { label: t("notSent"),    value: pedido.sin_enviar,  dot: "#71717A" },
    { label: t("pending"),    value: pedido.pendientes,  dot: "#D97706" },
    { label: t("comentado"),  value: pedido.comentados,  dot: "#CA8A04" },
    { label: t("rejected"),   value: pedido.reclamados,  dot: "#DC2626" },
  ].filter(b => b.value > 0);

  const kpis = [
    { label: "Docs",           value: pedido.total,     color: "var(--text-main)" },
    { label: t("colCritical"), value: pedido.criticos,  color: pedido.criticos > 0 ? "#DC2626" : "var(--text-muted)" },
    { label: t("approved"),    value: pedido.aprobados,  color: "#16A34A" },
  ];

  return ReactDOM.createPortal(
    <motion.div
      initial={{ opacity: 0, y: placeAbove ? 8 : -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: placeAbove ? 4 : -4, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${health.color}`,
        borderRadius: 12,
        boxShadow: "var(--shadow-dropdown)",
        padding: 16,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)" }}>
            {pedido.pedido}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
            background: health.color + "18", color: health.color,
            border: `1px solid ${health.color}33`, whiteSpace: "nowrap",
          }}>
            {health.label}
          </span>
        </div>

        {/* Subheader: cliente · material */}
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[pedido.cliente, pedido.material].filter(Boolean).join(" · ") || "—"}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />

        {/* Progress bar + percentage */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: "100%", borderRadius: 8, background: `linear-gradient(90deg, ${health.color}CC, ${health.color})` }}
            />
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: health.color, minWidth: 36, textAlign: "right" }}>
            {pct}%
          </span>
        </div>

        {/* KPIs row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: breakdownItems.length > 0 ? 10 : 0 }}>
          {kpis.map(k => (
            <div key={k.label} style={{
              background: (k.color === "var(--text-main)" ? "var(--border)" : k.color) + "12",
              borderRadius: 8, padding: "8px 0", textAlign: "center",
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, marginTop: 3 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Breakdown */}
        {breakdownItems.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 2 }}>
            {breakdownItems.map(b => (
              <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: b.dot, flexShrink: 0 }} />
                <span style={{ color: "var(--text-muted)" }}>{b.value} {b.label.toLowerCase()}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          style={{
            width: "100%", padding: "10px 16px", marginTop: 12,
            background: "var(--accent)", color: "#FFF", border: "none",
            borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <ArrowSquareOut size={15} weight="bold" />
          {t("openDashboard")}
        </motion.button>
      </div>
    </motion.div>,
    document.body
  );
}
