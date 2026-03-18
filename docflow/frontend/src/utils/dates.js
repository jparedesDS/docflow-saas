/**
 * Centralized date utility functions for DocFlow.
 */

/** Format a date string for display: "12 mar 2026" */
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

/** Format a date string as ISO date only: "2026-03-12" */
export function formatDateISO(val) {
  if (!val) return "\u2014";
  const s = String(val);
  if (s.includes("T")) return s.split("T")[0];
  return s;
}

/** Format date with time: "12 mar, 09:30" */
export function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Relative time: "hace 5m", "hace 3h", "hace 2d" */
export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

/** Days since a date (integer). Returns null if invalid. */
export function diasDesde(fechaStr) {
  if (!fechaStr) return null;
  const clean = String(fechaStr).includes("T") ? String(fechaStr).split("T")[0] : String(fechaStr);
  const d = new Date(clean);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/** Alias for diasDesde — used in Reclamaciones */
export const diffDaysFromNow = diasDesde;
