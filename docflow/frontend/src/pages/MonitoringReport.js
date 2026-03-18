import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import { DownloadSimple, Copy, ArrowClockwise } from "@phosphor-icons/react";
import api from "../services/api";
import { API_BASE } from "../config";
import { STATUS_COLORS_DISPLAY as STATUS_COLORS } from "../constants/status";
import { useI18n } from "../contexts/I18nContext";

function StatusBadge({ value }) {
  const cfg = STATUS_COLORS[value] || STATUS_COLORS["Sin Enviar"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4,
      fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color }} />
      {value || "—"}
    </span>
  );
}

// ─── Tabla genérica ──────────────────────────────────────────────────────────
const SECTION_COLS = {
  all_docs:     ["Nº Pedido","Cliente","Nº Doc. EIPSA","Nº Doc. Cliente","Título","Tipo Doc.","Nº Revisión","Estado","Crítico","Fecha Env. Doc.","Días Envío","Días Devolución","Repsonsable"],
  enviados:     ["Nº Pedido","Cliente","Nº Doc. EIPSA","Nº Doc. Cliente","Título","Tipo Doc.","Nº Revisión","Estado","Crítico","Fecha Env. Doc.","Días Devolución","Repsonsable"],
  devoluciones: ["Nº Pedido","Cliente","Nº Doc. EIPSA","Nº Doc. Cliente","Título","Tipo Doc.","Nº Revisión","Estado","Crítico","Fecha Env. Doc.","Días Devolución","Repsonsable"],
  criticos:     ["Nº Pedido","Cliente","Nº Doc. EIPSA","Título","Tipo Doc.","Estado","Crítico","Fecha Env. Doc.","Días Envío","Días Devolución","Repsonsable"],
  criticos_15d: ["Nº Pedido","Cliente","Nº Doc. EIPSA","Título","Tipo Doc.","Estado","Crítico","Fecha Env. Doc.","Días Envío","Días Devolución","Repsonsable"],
  sin_enviar:   ["Nº Pedido","Cliente","Nº Doc. EIPSA","Título","Tipo Doc.","Nº Revisión","Estado","Crítico","Fecha Pedido","Días Envío","Repsonsable"],
};

const COL_LABEL = { "Repsonsable": "Responsable" };

function DataTable({ data, sectionKey }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const cols = SECTION_COLS[sectionKey] || (data[0] ? Object.keys(data[0]).slice(0, 12) : []);

  const filtered = data.filter(row =>
    !search || cols.some(c => String(row[c] || "").toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol] ?? "", bv = b[sortCol] ?? "";
        const cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
        return sortAsc ? cmp : -cmp;
      })
    : filtered;

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(v => !v);
    else { setSortCol(col); setSortAsc(true); }
  };

  if (!data.length) {
    return (
      <div className="text-text-muted" style={{ padding: 48, textAlign: "center", fontSize: 13 }}>
        Sin datos en esta sección
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar en esta sección..."
            className="input-field"
            style={{ width: 280 }}
          />
        </div>
        <span className="text-text-muted" style={{ fontSize: 11 }}>{sorted.length} registros</span>
      </div>
      <div className="border border-border" style={{ overflowX: "auto", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-sidebar)" }}>
              {cols.map(col => (
                <th key={col}
                  onClick={() => handleSort(col)}
                  style={{
                    padding: "9px 10px", textAlign: "left",
                    color: sortCol === col ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                    userSelect: "none",
                    borderRight: "1px solid var(--border)",
                    fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase",
                  }}>
                  {COL_LABEL[col] || col} {sortCol === col ? (sortAsc ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const diasDev = Number(row["Días Devolución"]);
              const urgente = diasDev >= 15;
              return (
                <tr key={i}
                  style={{
                    background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)",
                    borderBottom: "1px solid var(--border)",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)"}>
                  {cols.map(col => {
                    const val = row[col] ?? "";
                    const isDiasDev = col === "Días Devolución";
                    return (
                      <td key={col} style={{
                        padding: "7px 10px", borderRight: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                        maxWidth: col === "Título" ? 280 : "auto",
                        overflow: col === "Título" ? "hidden" : "visible",
                        textOverflow: col === "Título" ? "ellipsis" : "clip",
                        color: isDiasDev && urgente ? "#DC2626" : "var(--text-sub)",
                        fontWeight: isDiasDev && urgente ? 700 : undefined,
                      }}>
                        {col === "Estado" ? <StatusBadge value={val} /> : col === "Título" ? <span title={String(val)}>{String(val)}</span> : String(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tabla Status Global ─────────────────────────────────────────────────────
function StatusGlobalTable({ data }) {
  const { t } = useI18n();
  if (!data.length) return <div className="text-text-muted" style={{ padding: 40, textAlign: "center" }}>{t('noData')}</div>;

  return (
    <div className="border border-border" style={{ overflowX: "auto", borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-sidebar)" }}>
            {[t('colPedido'),t('client'),t('filterResponsible'),t('total'),t('approved'),t('pending'),t('com_menores'),t('rejected'),t('docsCritical'),"% Comp."].map(h => (
              <th key={h} className="text-text-muted" style={{
                padding: "9px 10px", fontWeight: 700,
                textAlign: "left", borderRight: "1px solid var(--border)",
                whiteSpace: "nowrap", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const pct = row.pct_completado || 0;
            const pctColor = pct >= 75 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
            return (
              <tr key={i}
                style={{
                  background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)",
                  borderBottom: "1px solid var(--border)",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)"}>
                <td style={{ padding: "7px 10px", fontWeight: 700, color: "var(--accent)", borderRight: "1px solid var(--border)" }}>{row.pedido}</td>
                <td className="text-text-sub" style={{ padding: "7px 10px", borderRight: "1px solid var(--border)" }}>{row.cliente}</td>
                <td className="text-text-sub" style={{ padding: "7px 10px", borderRight: "1px solid var(--border)" }}>{row.responsable}</td>
                <td className="text-text-main" style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, borderRight: "1px solid var(--border)" }}>{row.total}</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#16A34A", fontWeight: 700, borderRight: "1px solid var(--border)" }}>{row.aprobados}</td>
                <td className="text-text-muted" style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid var(--border)" }}>{row.pendientes}</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#CA8A04", borderRight: "1px solid var(--border)" }}>{row.comentados}</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: "#DC2626", borderRight: "1px solid var(--border)" }}>{row.reclamados}</td>
                <td style={{ padding: "7px 10px", textAlign: "center", color: row.criticos > 0 ? "#DC2626" : "var(--text-muted)", fontWeight: row.criticos > 0 ? 700 : undefined, borderRight: "1px solid var(--border)" }}>{row.criticos}</td>
                <td style={{ padding: "7px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        style={{ height: "100%", background: `linear-gradient(90deg, ${pctColor}CC, ${pctColor})`, borderRadius: 4 }}
                      />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: pctColor, minWidth: 32 }}>{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Secciones ───────────────────────────────────────────────────────────────
function getSections(t) {
  return [
    { key: "all_docs",      label: t('docsAllDocs'),      color: "#A78BFA" },
    { key: "enviados",      label: t('sent'),              color: "#16A34A" },
    { key: "devoluciones",  label: t('devolutions'),       color: "#D97706" },
    { key: "criticos",      label: t('docsCritical'),      color: "#CA8A04" },
    { key: "criticos_15d",  label: t('docsCritical15'),    color: "#DC2626" },
    { key: "sin_enviar",    label: t('notSent'),           color: "#71717A" },
    { key: "status_global", label: t('seguimiento'),       color: "#2563EB" },
  ];
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function MonitoringReport() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("enviados");
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/reports/monitoring-report");
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownloadExcel = () => {
    window.open(`${API_BASE}/reports/download/monitoring-excel`, "_blank");
  };

  const handleCopyShared = async () => {
    setCopying(true);
    setCopyMsg(null);
    try {
      const res = await api.post("/reports/copy-to-shared");
      const json = res.data;
      setCopyMsg(json.ok ? `Copiado: ${json.filename}` : `Error: ${json.error}`);
    } catch (e) {
      setCopyMsg(`Error: ${e.message}`);
    } finally {
      setCopying(false);
      setTimeout(() => setCopyMsg(null), 5000);
    }
  };

  const kpis = data?.kpis || {};
  const sectionData = data ? (activeSection === "status_global" ? data.status_global : data[activeSection] ?? data.all_docs) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader title={t('mrTitle')} description={kpis.generado ? `Generado: ${kpis.generado}` : t('mrDesc')}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={fetchData} disabled={loading}
          className="btn-secondary inline-flex items-center gap-1.5">
          <ArrowClockwise size={13} />
          {loading ? t('loading') : t('update')}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleDownloadExcel} disabled={!data || loading}
          className="btn-primary inline-flex items-center gap-1.5"
          style={{ background: "#16A34A" }}>
          <DownloadSimple size={13} />
          Descargar Excel
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleCopyShared} disabled={!data || loading || copying}
          className="btn-primary inline-flex items-center gap-1.5">
          <Copy size={13} />
          {copying ? "Copiando..." : "Copiar a M:\\"}
        </motion.button>
      </PageHeader>

      {/* Toast copy */}
      <AnimatePresence>
        {copyMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-lg"
            style={{
              padding: "10px 16px", fontSize: 13, fontWeight: 600,
              background: copyMsg.startsWith("Error") ? "#DC262618" : "#16A34A18",
              color: copyMsg.startsWith("Error") ? "#DC2626" : "#16A34A",
              border: `1px solid ${copyMsg.startsWith("Error") ? "#DC262640" : "#16A34A40"}`,
            }}>
            {copyMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-lg"
          style={{ padding: "12px 16px", background: "#DC262618", color: "#DC2626", fontSize: 13, border: "1px solid #DC262640" }}>
          Error al cargar datos: {error}
        </motion.div>
      )}

      {/* KPI Cards */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} height={72} />)}
        </div>
      )}

      {!loading && kpis.total !== undefined && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          <KpiCard label={t('totalDocs')}      value={kpis.total}              color="var(--text-main)"  index={0} />
          <KpiCard label={t('approved')}      value={kpis.aprobados}          color="#16A34A"           index={1} sub={`${kpis.pct_completado}% ${t('docsCompletedPct')}`} />
          <KpiCard label={t('sent')}          value={kpis.enviados}           color="#2563EB"           index={2} />
          <KpiCard label={t('devolutions')}   value={kpis.devoluciones}       color="#D97706"           index={3} />
          <KpiCard label={t('docsCritical')}  value={kpis.criticos}           color="#DB2777"           index={4} />
          <KpiCard label={t('docsCritical15')} value={kpis.criticos_15d}      color="#DC2626"           index={5} />
          <KpiCard label={t('notSent')}       value={kpis.sin_enviar}         color="var(--text-muted)" index={6} />
          <KpiCard label={t('slaDays')}       value={kpis.media_dias_devolucion || "—"} color="#CA8A04" index={7} />
        </div>
      )}

      {/* Barra de progreso global */}
      {!loading && kpis.pct_completado !== undefined && (
        <div className="card" style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span className="text-text-sub" style={{ fontSize: 13, fontWeight: 700 }}>Progreso Global</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: kpis.pct_completado >= 75 ? "#16A34A" : kpis.pct_completado >= 50 ? "#D97706" : "#DC2626" }}>
              {kpis.pct_completado}%
            </span>
          </div>
          <div style={{ height: 12, background: "var(--border)", borderRadius: 6, overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${kpis.pct_completado}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: "100%", borderRadius: 6,
                background: kpis.pct_completado >= 75
                  ? "linear-gradient(90deg, #15803D, #16A34A)"
                  : kpis.pct_completado >= 50
                  ? "linear-gradient(90deg, #B45309, #D97706)"
                  : "linear-gradient(90deg, #B91C1C, #DC2626)",
              }}
            />
          </div>
        </div>
      )}

      {/* Secciones */}
      <div className="card" style={{ overflow: "hidden" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto", position: "relative" }}>
          {getSections(t).map(sec => {
            const count = data ? (sec.key === "status_global" ? data.status_global?.length : (data[sec.key] ?? data.all_docs)?.length) : 0;
            const isActive = activeSection === sec.key;
            return (
              <div key={sec.key} style={{ position: "relative" }}>
                <button
                  onClick={() => setActiveSection(sec.key)}
                  style={{
                    padding: "10px 18px", border: "none", cursor: "pointer", fontSize: 13,
                    fontWeight: isActive ? 700 : 500, whiteSpace: "nowrap",
                    background: "none",
                    color: isActive ? "var(--text-main)" : "var(--text-muted)",
                    transition: "color 0.15s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                  {sec.label}
                  {count !== undefined && (
                    <span style={{
                      background: isActive ? sec.color + "20" : "var(--bg-hover)",
                      color: isActive ? sec.color : "var(--text-muted)",
                      borderRadius: 999, fontSize: 10, fontWeight: 700, padding: "1px 6px",
                    }}>
                      {count}
                    </span>
                  )}
                </button>
                {isActive && (
                  <motion.div
                    layoutId="monitoring-tab-indicator"
                    style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: sec.color, borderRadius: 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Contenido */}
        <div style={{ padding: 20 }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} height={36} />)}
            </div>
          )}
          <AnimatePresence mode="wait">
            {!loading && data && (
              <motion.div key={activeSection} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {activeSection === "status_global"
                  ? <StatusGlobalTable data={sectionData || []} />
                  : <DataTable data={sectionData || []} sectionKey={activeSection} />
                }
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
