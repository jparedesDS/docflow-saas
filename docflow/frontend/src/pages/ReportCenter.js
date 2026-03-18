import React, { useState } from "react";
import { FileText, EnvelopeSimple, Table, ChartLineUp, ClockCountdown, Sliders } from "@phosphor-icons/react";
import { useToast } from "../contexts/ToastContext";
import { useI18n } from "../contexts/I18nContext";
import api from "../services/api";
import ScheduledReports from "./ScheduledReports";

const REPORTS = [
  {
    id: "monthly-pdf",
    title: "Informe Mensual",
    description: "PDF completo con métricas del mes",
    icon: FileText,
    color: "#4F46E5",
    actions: [
      { label: "Generar", endpoint: "/reports/monthly-pdf", method: "download" },
    ],
  },
  {
    id: "weekly-pdf",
    title: "Informe Semanal",
    description: "PDF semanal con KPIs, urgencias y rendimiento",
    icon: FileText,
    color: "#4F46E5",
    actions: [
      { label: "Generar", endpoint: "/reports/weekly-pdf", method: "download" },
    ],
  },
  {
    id: "weekly-executive",
    title: "Resumen Monitoring Report",
    description: "Email ejecutivo semanal con KPIs",
    icon: EnvelopeSimple,
    color: "#4F46E5",
    actions: [
      { label: "Preview", endpoint: "/reports/weekly-executive/preview", method: "preview", variant: "outline" },
      { label: "Enviar", endpoint: "/reports/weekly-executive", method: "post" },
    ],
  },
  {
    id: "weekly-personal",
    title: "Monitoring Report (Personal)",
    description: "Email individual por doc controller",
    icon: EnvelopeSimple,
    color: "#0D9488",
    actions: [
      { label: "Preview (JP)", endpoint: "/reports/weekly-personal/preview?initials=JP", method: "preview", variant: "outline" },
      { label: "Enviar Todos", endpoint: "/reports/weekly-personal", method: "post" },
    ],
  },
  {
    id: "export-excel",
    title: "Export Excel",
    description: "Datos completos en formato Excel",
    icon: Table,
    color: "#16A34A",
    actions: [
      { label: "Descargar", endpoint: "/reports/download/excel", method: "download" },
    ],
  },
  {
    id: "monitoring-excel",
    title: "Monitoring Report",
    description: "Excel multi-sheet de monitoring",
    icon: ChartLineUp,
    color: "#2563EB",
    actions: [
      { label: "Descargar", endpoint: "/reports/download/monitoring-excel", method: "download" },
    ],
  },
  {
    id: "scheduled",
    title: "Reportes Programados",
    description: "Configura envíos automáticos",
    icon: ClockCountdown,
    color: "#4F46E5",
    navigable: true,
  },
  {
    id: "custom",
    title: "Custom Reports",
    description: "Crea reportes personalizados",
    icon: Sliders,
    color: "#64748B",
    disabled: true,
  },
];

export default function ReportCenter() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [loadingId, setLoadingId] = useState(null);
  const [showScheduled, setShowScheduled] = useState(false);

  const handleAction = async (report, action) => {
    setLoadingId(report.id);
    try {
      if (action.method === "preview") {
        const res = await api.get(action.endpoint, { responseType: "text" });
        const w = window.open("", "_blank");
        w.document.write(res.data);
        w.document.close();
      } else if (action.method === "download") {
        const res = await api.get(action.endpoint, { responseType: "blob" });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${report.id}_${new Date().toISOString().slice(0, 10)}.${action.endpoint.includes("pdf") ? "pdf" : "xlsx"}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        showToast(`${report.title} descargado`, "success");
      } else {
        await api.post(action.endpoint);
        showToast(`${report.title} enviado correctamente`, "success");
      }
    } catch (e) {
      showToast(e.response?.data?.error || e.response?.data?.detail || `Error al generar ${report.title}`, "error");
    }
    setLoadingId(null);
  };

  if (showScheduled) {
    return <ScheduledReports onBack={() => setShowScheduled(false)} />;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('rcTitle')}</h3>
        <p className="text-text-muted" style={{ fontSize: 13 }}>Genera, exporta y programa reportes del sistema</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {REPORTS.map(report => {
          const Icon = report.icon;
          const isLoading = loadingId === report.id;
          return (
            <div key={report.id} className="card" style={{ padding: 20, opacity: report.disabled ? 0.5 : 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `${report.color}14`, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} style={{ color: report.color }} />
                </div>
                <div>
                  <p className="text-text-main" style={{ fontSize: 14, fontWeight: 700 }}>{report.id === "scheduled" ? t('scheduledReports') : report.title}</p>
                  <p className="text-text-muted" style={{ fontSize: 12 }}>{report.id === "scheduled" ? t('rcConfigAutoSend') : report.description}</p>
                </div>
              </div>

              {report.disabled ? (
                <button disabled style={{ marginTop: "auto",
                  width: "100%", padding: "8px 0", border: "1px solid var(--border)",
                  borderRadius: 8, background: "var(--bg-hover)", color: "var(--text-muted)",
                  fontSize: 13, fontWeight: 600, cursor: "not-allowed",
                }}>
                  {t('comingSoon')}
                </button>
              ) : report.navigable ? (
                <button onClick={() => setShowScheduled(true)} style={{ marginTop: "auto",
                  width: "100%", padding: "8px 0", border: "none",
                  borderRadius: 8, background: report.color, color: "#FFF",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>
                  {t('configure')}
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  {report.actions.map((action, i) => (
                    <button key={i}
                      onClick={() => handleAction(report, action)}
                      disabled={isLoading}
                      style={{
                        flex: 1, padding: "8px 0",
                        border: action.variant === "outline" ? `1px solid ${report.color}` : "none",
                        borderRadius: 8,
                        background: action.variant === "outline" ? "transparent" : report.color,
                        color: action.variant === "outline" ? report.color : "#FFF",
                        fontSize: 13, fontWeight: 600,
                        cursor: isLoading ? "wait" : "pointer",
                        opacity: isLoading ? 0.7 : 1,
                      }}>
                      {isLoading ? "..." : ({Generar: t('rcGenerate'), Preview: t('rcPreview'), Descargar: t('rcDownload'), Enviar: t('rcSend'), "Enviar Todos": t('rcSendAll')}[action.label] || action.label)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
