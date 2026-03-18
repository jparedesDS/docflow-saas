/**
 * Centralized status color definitions for DocFlow.
 * Import from here instead of defining locally in each page.
 */

// Full status colors (bg, text/color, dot, border) — used by Documents, EmailAssistants, StatusGlobal, etc.
export const STATUS_COLORS = {
  aprobado:    { bg: "#16A34A18", text: "#16A34A", color: "#16A34A", dot: "#16A34A", border: "#16A34A40" },
  com_menores: { bg: "#D9770618", text: "#D97706", color: "#D97706", dot: "#D97706", border: "#D9770640" },
  com_mayores: { bg: "#DB277718", text: "#DB2777", color: "#DB2777", dot: "#DB2777", border: "#DB277740" },
  enviado:     { bg: "#2563EB18", text: "#2563EB", color: "#2563EB", dot: "#2563EB", border: "#2563EB40" },
  comentado:   { bg: "#CA8A0418", text: "#CA8A04", color: "#CA8A04", dot: "#CA8A04", border: "#CA8A0440" },
  rechazado:   { bg: "#DC262618", text: "#DC2626", color: "#DC2626", dot: "#DC2626", border: "#DC262640" },
  informativo: { bg: "#2563EB18", text: "#2563EB", color: "#2563EB", dot: "#2563EB", border: "#2563EB40" },
  sin_enviar:  { bg: "var(--bg-hover)", text: "var(--text-muted)", color: "var(--text-muted)", dot: "var(--text-muted)", border: "var(--border)" },
};

// Lookup with key normalization: "Com. Menores" → "com_menores"
export function getStatusColor(rawStatus) {
  if (!rawStatus) return STATUS_COLORS.sin_enviar;
  const key = String(rawStatus).trim().toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "_");
  return STATUS_COLORS[key] || STATUS_COLORS.sin_enviar;
}

// MonitoringReport uses capitalized keys with dots — this maps them
export const STATUS_COLORS_DISPLAY = {
  "Aprobado":     STATUS_COLORS.aprobado,
  "Enviado":      STATUS_COLORS.enviado,
  "Com. Menores": STATUS_COLORS.com_menores,
  "Com. Mayores": STATUS_COLORS.com_mayores,
  "Comentado":    STATUS_COLORS.comentado,
  "Rechazado":    STATUS_COLORS.rechazado,
  "Sin Enviar":   STATUS_COLORS.sin_enviar,
};

// Dashboard uses aggregate keys
export const DASHBOARD_COLORS = {
  aprobados: "#16A34A",
  enviados: "#2563EB",
  devoluciones: "#D97706",
  sin_enviar: "#64748B",
  criticos: "#DC2626",
};

// Reclamaciones uses display-cased keys
export const CLAIM_STATUS_COLORS = {
  "Enviado":           STATUS_COLORS.enviado,
  "Aprobado":          STATUS_COLORS.aprobado,
  "Aprobado con Com.": STATUS_COLORS.comentado,
  "Rechazado":         STATUS_COLORS.rechazado,
  "En Revisión":       STATUS_COLORS.com_mayores,
};

// DocuSign — completely different domain (envelope statuses)
export const DOCUSIGN_STATUS_COLORS = {
  sent:       { bg: "#FEF3C7", text: "#92400E", label: "Enviado" },
  delivered:  { bg: "#DBEAFE", text: "#1E40AF", label: "Entregado" },
  completed:  { bg: "#DCFCE7", text: "#166534", label: "Completado" },
  declined:   { bg: "#FEE2E2", text: "#991B1B", label: "Rechazado" },
  voided:     { bg: "#F3F4F6", text: "#6B7280", label: "Anulado" },
  created:    { bg: "#EDE9FE", text: "#5B21B6", label: "Borrador" },
  timed_out:  { bg: "#FFF7ED", text: "#C2410C", label: "Expirado" },
};

// ErpTags — tag inspection statuses
export const TAG_STATUS_COLORS = {
  "aprobado":    "#16A34A",
  "pendiente":   "#CA8A04",
  "rechazado":   "#DC2626",
  "en revisión": "#2563EB",
  "en revision": "#2563EB",
  "liberado":    "#16A34A",
  "fabricado":   "#6366F1",
};

// Tracking sub-status colors
export const SUB_STATUS_COLORS = {
  rechazado:   "#DC2626",
  com_menores: "#D97706",
  com_mayores: "#DB2777",
  comentado:   "#CA8A04",
};

// SeguimientoDoc — simplified (bg + color only)
export const SEGUIMIENTO_STATUS_COLORS = {
  "rechazado":    { bg: "#DC262618", color: "#DC2626" },
  "com. menores": { bg: "#D9770618", color: "#D97706" },
  "com. mayores": { bg: "#DB277718", color: "#DB2777" },
  "comentado":    { bg: "#CA8A0418", color: "#CA8A04" },
  "enviado":      { bg: "#2563EB18", color: "#2563EB" },
  "sin enviar":   { bg: "var(--bg-hover)", color: "var(--text-muted)" },
};

// Role colors
export const ROLE_COLORS = {
  "Document Controller": "#4F46E5",
  "Project Manager": "#0D9488",
  "Comercial": "#D97706",
};
