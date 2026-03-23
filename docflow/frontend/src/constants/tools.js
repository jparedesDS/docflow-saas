import {
  CalendarBlank, PaperPlaneTilt,
  Tray, Megaphone, PenNib, ChartBar, ShieldCheck,
} from "@phosphor-icons/react";

export const TOOLS_CONFIG = [
  { key: "agenda",         labelKey: "toolAgenda",         descKey: "toolAgendaDesc",         icon: CalendarBlank,  color: "#4F46E5", category: "organizacion", roles: ["admin", "Document Controller", "Project Manager", "Comercial"] },
  { key: "inbox-ai",       labelKey: "toolInboxAI",        descKey: "toolInboxAIDesc",        icon: Tray,           color: "#4F46E5", category: "comunicacion", roles: ["admin", "Document Controller", "Project Manager", "Comercial"] },
  { key: "devolutions",    labelKey: "toolDevolutions",    descKey: "toolDevolutionsDesc",    icon: PaperPlaneTilt, color: "#7C3AED", category: "comunicacion", roles: ["admin", "Document Controller"] },
  { key: "claims",         labelKey: "toolClaims",         descKey: "toolClaimsDesc",         icon: Megaphone,      color: "#DB2777", category: "comunicacion", roles: ["admin", "Document Controller"] },
  { key: "docusign",       labelKey: "toolDocuSign",       descKey: "toolDocuSignDesc",       icon: PenNib,         color: "#D97706", category: "documentos",   roles: ["admin", "Document Controller", "Project Manager"] },
  { key: "report-center",  labelKey: "toolReportCenter",   descKey: "toolReportCenterDesc",   icon: ChartBar,       color: "#0D9488", category: "informes",     roles: ["admin", "Document Controller", "Project Manager", "Comercial"] },
  { key: "admin",          labelKey: "toolAdmin",          descKey: "toolAdminDesc",          icon: ShieldCheck,    color: "#DC2626", category: "admin",        roles: ["admin", "Document Controller"] },
];

export const TOOL_CATEGORIES = [
  { key: "organizacion", labelKey: "toolCatOrganization" },
  { key: "comunicacion",  labelKey: "toolCatCommunication" },
  { key: "documentos",    labelKey: "toolCatDocuments" },
  { key: "informes",      labelKey: "toolCatReports" },
  { key: "admin",         labelKey: "toolCatAdmin" },
];
