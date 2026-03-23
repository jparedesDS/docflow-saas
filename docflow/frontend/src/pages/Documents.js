import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import DocumentDetail from "../components/DocumentDetail";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import AnimatedNumber from "../components/AnimatedNumber";
import { DownloadSimple, CaretUp, CaretDown, Files, PaperPlaneTilt, ArrowUUpLeft, Warning, WarningOctagon, ClockCountdown, CheckCircle, FileMagnifyingGlass } from "@phosphor-icons/react";
import { STATUS_COLORS } from "../constants/status";
import { useI18n } from "../contexts/I18nContext";
import { useTenant } from "../contexts/TenantContext";

const BulkActionBar = lazy(() => import("../components/BulkActionBar"));
const FacetedSearch = lazy(() => import("../components/FacetedSearch"));

function getStatusStyle(status) {
  const n = (status || "").toLowerCase().trim().replace(/[\s.]+/g, "_");
  if (STATUS_COLORS[n]) return STATUS_COLORS[n];
  for (const [key, style] of Object.entries(STATUS_COLORS)) {
    if (n.includes(key) || key.includes(n)) return style;
  }
  return { bg: "var(--bg-hover)", text: "var(--text-muted)", dot: "var(--text-muted)", border: "var(--border)", label: status };
}

function getRowBg(doc, index) {
  const estado = String(doc["Estado"] || "").toLowerCase();
  const critico = String(doc["Crítico"] || "").toLowerCase();
  if (estado.includes("aprobado")) return index % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)";
  if (critico === "sí" || critico === "si") return "#DC26260A";
  const dias = Number(doc["Días Envío"]);
  if (!isNaN(dias)) {
    if (dias > 30) return "#DC26260A";
    if (dias > 14) return "#CA8A0408";
  }
  return index % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)";
}

function formatCell(val) {
  if (val === null || val === undefined || val === "") return "—";
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.split("T")[0];
  return s;
}

function SkeletonTable() {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <SkeletonCard height={20} />
        {[...Array(12)].map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            {[...Array(8)].map((_, j) => <SkeletonCard key={j} height={14} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

const VISIBLE_COLUMNS = [
  "Nº Pedido", "Nº Doc. EIPSA", "Título", "Cliente",
  "Repsonsable", "Tipo Doc.", "Crítico", "Info/Review",
  "Estado", "Nº Revisión", "Fecha Env. Doc.", "Días Devolución",
];

const COMPACT_COLS = new Set([
  "Crítico", "Info/Review", "Nº Revisión", "Días Envío", "Días Devolución", "Estado",
]);

function getColLabels(t) {
  return {
    "Nº Pedido": t("colPedido"),
    "Nº Doc. EIPSA": t("colDocEipsa"),
    "Título": t("colTitle"),
    "Cliente": t("colClient"),
    "Responsable": t("filterResponsible"),
    "Repsonsable": t("colRespDoc"),
    "Tipo Doc.": t("colType"),
    "Crítico": t("colCritical"),
    "Info/Review": t("colIR"),
    "Estado": t("colStatus"),
    "Nº Revisión": t("colRev"),
    "Días Envío": t("colDaysSent"),
    "Fecha Env. Doc.": t("colSentDate"),
    "Días Devolución": t("colDaysReturn"),
  };
}

export default function Documents() {
  const { t } = useI18n();
  const [documents, setDocuments] = useState([]);
  const [allColumns, setAllColumns] = useState([]);
  const [filters, setFilters] = useState({ q: "", estado: "", cliente: "", responsable: "", pedido: "" });
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [activeKpi, setActiveKpi] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const tenant = useTenant();
  const canBulkAction = tenant?.hasFeature?.("bulk_actions") ?? false;
  const [showFacets, setShowFacets] = useState(false);
  const [facetFilters, setFacetFilters] = useState({});
  const pageSize = 30;

  const COL_LABELS = useMemo(() => getColLabels(t), [t]);

  useEffect(() => { loadDocuments(); }, []);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const [docsRes, colsRes] = await Promise.all([
        api.get("/documents/monitoring"),
        api.get("/documents/monitoring/columns"),
      ]);
      setDocuments(docsRes.data);
      setAllColumns(colsRes.data);
    } catch (err) {
      console.error("Error cargando monitoring:", err);
      showToast("Error al cargar documentos", "error");
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.q) params.q = filters.q;
      if (filters.estado) params.estado = filters.estado;
      if (filters.cliente) params.cliente = filters.cliente;
      if (filters.responsable) params.responsable = filters.responsable;
      if (filters.pedido) params.pedido = filters.pedido;
      const res = await api.get("/documents/monitoring", { params });
      setDocuments(res.data);
      showToast(`${res.data.length} documentos encontrados`);
    } catch (err) {
      showToast("Error en la búsqueda", "error");
    }
    setLoading(false);
  };

  const handleClear = () => {
    setFilters({ q: "", estado: "", cliente: "", responsable: "", pedido: "" });
    loadDocuments();
  };

  const handleExport = async () => {
    try {
      showToast("Generando Excel monitoring...");
      const params = {};
      if (filters.estado) params.estado = filters.estado;
      if (filters.cliente) params.cliente = filters.cliente;
      if (filters.responsable) params.responsable = filters.responsable;
      if (filters.q) params.q = filters.q;
      const res = await api.get("/reports/download/excel", { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "monitoring_report_docflow.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("Excel descargado", "success");
    } catch (err) {
      showToast("Error al exportar", "error");
    }
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const displayCols = VISIBLE_COLUMNS.filter(c => allColumns.includes(c));

  let filtered = documents;

  // Apply facet filters
  if (Object.keys(facetFilters).length > 0) {
    filtered = filtered.filter(d => {
      for (const [facet, values] of Object.entries(facetFilters)) {
        if (!values || values.length === 0) continue;
        const docVal = String(d[facet] || "").trim();
        const match = facet === "Estado" && !docVal
          ? values.includes("(vacío)")
          : values.includes(docVal);
        if (!match) return false;
      }
      return true;
    });
  }

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      const va = String(a[sortCol] ?? "");
      const vb = String(b[sortCol] ?? "");
      const na = parseFloat(va), nb = parseFloat(vb);
      if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  const tableFiltered = useMemo(() => {
    if (!activeKpi) return filtered;
    return filtered.filter(d => {
      const estado = d["Estado"] || "";
      const critico = d["Crítico"] || "";
      if (activeKpi === "aprobados")    return /aprobado/i.test(estado);
      if (activeKpi === "enviados")     return /enviado/i.test(estado);
      if (activeKpi === "devoluciones") return /devoluci|reclamad|comentad|rechazad|com\.\s*(menor|mayor)/i.test(estado);
      if (activeKpi === "criticos")     return /^s[ií]$/i.test(critico);
      if (activeKpi === "criticos15")   return /^s[ií]$/i.test(critico) && Number(d["Días Devolución"] || 0) >= 15;
      if (activeKpi === "sinEnviar")    return !String(estado).trim();
      return true;
    });
  }, [filtered, activeKpi]);

  const totalPages = Math.ceil(tableFiltered.length / pageSize);
  const paged = tableFiltered.slice(page * pageSize, (page + 1) * pageSize);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const aprobados = filtered.filter(d => /aprobado/i.test(d["Estado"] || "")).length;
    const enviados = filtered.filter(d => /enviado/i.test(d["Estado"] || "")).length;
    const devoluciones = filtered.filter(d => /devoluci|reclamad|comentad|rechazad|com\.\s*(menor|mayor)/i.test(d["Estado"] || "")).length;
    const criticos = filtered.filter(d => /^s[ií]$/i.test(d["Crítico"] || "")).length;
    const criticos15 = filtered.filter(d =>
      /^s[ií]$/i.test(d["Crítico"] || "") && Number(d["Días Devolución"] || 0) >= 15
    ).length;
    const sinEnviar = filtered.filter(d => !(d["Estado"] || "").trim()).length;
    const diasDevArr = filtered.map(d => Number(d["Días Devolución"] || 0)).filter(v => v > 0);
    const mediaDias = diasDevArr.length
      ? Math.round(diasDevArr.reduce((a, b) => a + b, 0) / diasDevArr.length)
      : 0;
    const pct = total > 0 ? Math.round((aprobados / total) * 100) : 0;
    return { total, aprobados, enviados, devoluciones, criticos, criticos15, sinEnviar, mediaDias, pct };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("docsMonitoringReport")} description={t("docsMonitoringDesc")} />
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-lg"
            style={{
              position: "fixed", top: 16, right: 16, zIndex: 50,
              padding: "10px 16px", fontSize: 13, fontWeight: 600,
              background: toast.type === "error" ? "#DC2626" : toast.type === "success" ? "#16A34A" : "var(--bg-sidebar)",
              color: "#FFF", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Cards — clickables para filtrar la tabla */}
      {(() => {
        const CARDS = [
          { key: null,           label: t("docsAll"),          value: kpis.total,        color: "#6366F1", Icon: Files,           sub: t("docsAllDocs") },
          { key: "aprobados",    label: t("docsApproved"),     value: kpis.aprobados,    color: "#16A34A", Icon: CheckCircle,     sub: `${kpis.pct}% ${t("docsCompletedPct")}` },
          { key: "enviados",     label: t("docsSent"),         value: kpis.enviados,     color: "#2563EB", Icon: PaperPlaneTilt,  sub: t("docsWaitingClient") },
          { key: "devoluciones", label: t("docsDevolutions"),  value: kpis.devoluciones, color: "#D97706", Icon: ArrowUUpLeft,    sub: t("docsWithComments") },
          { key: "criticos",     label: t("docsCritical"),     value: kpis.criticos,     color: "#DB2777", Icon: Warning,         sub: t("docsMarkedCritical") },
          { key: "criticos15",   label: t("docsCritical15"),   value: kpis.criticos15,   color: "#DC2626", Icon: WarningOctagon,  sub: t("docsCritical15Days") },
          { key: "sinEnviar",    label: t("docsNotSent"),      value: kpis.sinEnviar,    color: "#71717A", Icon: ClockCountdown,  sub: t("docsPendingSend") },
        ];
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            {CARDS.map((card, i) => {
              const isActive = activeKpi === card.key;
              return (
                <motion.div
                  key={card.key ?? "todos"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setActiveKpi(isActive ? null : card.key); setPage(0); }}
                  className="rounded-xl"
                  style={{
                    background: isActive ? `${card.color}14` : "var(--bg-card)",
                    border: `1px solid ${isActive ? `${card.color}50` : "var(--border)"}`,
                    borderTop: `3px solid ${card.color}`,
                    padding: "10px 14px",
                    cursor: "pointer",
                    boxShadow: isActive ? `0 0 0 2px ${card.color}30` : "none",
                    transition: "all 0.15s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="text-text-muted" style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {card.label}
                    </span>
                    <card.Icon size={14} weight="fill" style={{ color: card.color, opacity: 0.7 }} />
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: card.color, lineHeight: 1, marginBottom: 6, fontFamily: "monospace" }}>
                    {card.value ?? 0}
                  </div>
                  <span className="text-text-muted" style={{ fontSize: 10 }}>{card.sub}</span>
                  {isActive && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: card.color, opacity: 0.5 }} />
                  )}
                </motion.div>
              );
            })}
          </div>
        );
      })()}

      {/* Filtros */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <FilterInput label={t("search")} placeholder={t("docsSearchPlaceholder")} value={filters.q}
            onChange={(v) => setFilters({ ...filters, q: v })} onEnter={handleSearch} flex />
          <FilterInput label={t("docsOrder")} placeholder="P-26/..." value={filters.pedido}
            onChange={(v) => setFilters({ ...filters, pedido: v })} width={112} />
          <FilterInput label={t("filterStatus")} placeholder={t("filterStatus")} value={filters.estado}
            onChange={(v) => setFilters({ ...filters, estado: v })} width={112} />
          <FilterInput label={t("filterClient")} placeholder={t("filterClient")} value={filters.cliente}
            onChange={(v) => setFilters({ ...filters, cliente: v })} width={112} />
          <FilterInput label={t("filterResponsible")} placeholder={t("filterResponsible")} value={filters.responsable}
            onChange={(v) => setFilters({ ...filters, responsable: v })} width={112} />
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleSearch}
            style={{ height: 36, padding: "0 20px", background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {t("search")}
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleClear}
            className="border border-border text-text-sub"
            style={{ height: 36, padding: "0 16px", background: "var(--bg-hover)", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {t("docsClean")}
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleExport}
            style={{ height: 36, padding: "0 16px", background: "#16A34A", color: "#FFF", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <DownloadSimple size={14} />
            Excel
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowFacets(!showFacets)}
            className="border border-border text-text-sub"
            style={{ height: 36, padding: "0 14px", background: showFacets ? "var(--accent)18" : "var(--bg-hover)", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {t("fsAdvancedSearch")}
          </motion.button>
          <span className="text-text-muted" style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>
            {tableFiltered.length} docs{activeKpi && <span style={{ color: "var(--accent)", marginLeft: 6 }}>· {t("docsFiltered")}</span>}
          </span>
        </div>
      </div>

      {/* Tabla */}
      {loading ? <SkeletonTable /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 320px)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr style={{ background: "var(--bg-sidebar)" }}>
                    <th style={{ padding: "8px 6px", width: 36, textAlign: "center" }}>
                      {canBulkAction && <input
                        type="checkbox"
                        checked={paged.length > 0 && paged.every(d => selectedRows.has(d["Nº Doc. EIPSA"] || d.id))}
                        onChange={(e) => {
                          const next = new Set(selectedRows);
                          paged.forEach(d => {
                            const key = d["Nº Doc. EIPSA"] || d.id;
                            if (e.target.checked) next.add(key);
                            else next.delete(key);
                          });
                          setSelectedRows(next);
                        }}
                        style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                      />}
                    </th>
                    {displayCols.map((col) => (
                      <th key={col} onClick={() => handleSort(col)}
                        className="text-text-muted"
                        style={{
                          padding: "8px 10px", fontWeight: 700, fontSize: 10,
                          letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap",
                          cursor: "pointer", userSelect: "none", borderRight: "1px solid var(--border)",
                          textAlign: COMPACT_COLS.has(col) ? "center" : "left",
                          minWidth: COMPACT_COLS.has(col) ? "60px" : col === "Título" ? "220px" : "auto",
                        }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {COL_LABELS[col] || col}
                          {sortCol === col && (
                            sortAsc ? <CaretUp size={10} /> : <CaretDown size={10} />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((doc, i) => {
                    const rowKey = doc["Nº Doc. EIPSA"] || doc.id || i;
                    const isSelected = selectedRows.has(rowKey);
                    return (
                    <tr key={i} onClick={() => setSelectedDoc(doc)}
                      style={{
                        background: isSelected ? "var(--accent)12" : getRowBg(doc, i),
                        cursor: "pointer", borderBottom: "1px solid var(--border)",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                      onMouseLeave={e => e.currentTarget.style.background = isSelected ? "var(--accent)12" : getRowBg(doc, i)}>
                      <td style={{ padding: "6px 6px", textAlign: "center", borderRight: "1px solid var(--border)" }}
                        onClick={(e) => e.stopPropagation()}>
                        {canBulkAction && <input type="checkbox" checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedRows);
                            if (isSelected) next.delete(rowKey); else next.add(rowKey);
                            setSelectedRows(next);
                          }}
                          style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                        />}
                      </td>
                      {displayCols.map((col) => (
                        <td key={col} style={{
                          padding: "6px 10px", whiteSpace: "nowrap",
                          borderRight: "1px solid var(--border)",
                          textAlign: COMPACT_COLS.has(col) ? "center" : "left",
                        }}>
                          {renderCell(doc, col, t)}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {paged.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <FileMagnifyingGlass size={48} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px", display: "block", opacity: 0.5 }} />
                <p className="text-text-main" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t("docsNoDocuments")}</p>
                <p className="text-text-muted" style={{ fontSize: 12 }}>
                  {activeKpi || filters.q || filters.estado || filters.cliente || filters.responsable || filters.pedido
                    ? t("docsNoMatchFilters")
                    : t("docsNoMonitoring")}
                </p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-page)",
              }}>
                <p className="text-text-muted" style={{ fontSize: 11 }}>
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, tableFiltered.length)} de {tableFiltered.length}
                </p>
                <div style={{ display: "flex", gap: 4 }}>
                  <PagBtn label={t("docsPrev")} onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} />
                  {Array.from({ length: Math.min(7, totalPages) }, (_, idx) => {
                    const start = Math.max(0, Math.min(page - 3, totalPages - 7));
                    const p = start + idx;
                    if (p >= totalPages) return null;
                    return <PagBtn key={p} label={String(p + 1)} onClick={() => setPage(p)} active={p === page} />;
                  })}
                  <PagBtn label={t("docsNext")} onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Faceted Search Panel */}
      {showFacets && (
        <Suspense fallback={null}>
          <div style={{
            position: "fixed", right: 0, top: 0, bottom: 0, width: 320, zIndex: 45,
            background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
            boxShadow: "-4px 0 24px rgba(0,0,0,0.15)", overflowY: "auto", padding: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="text-text-main" style={{ fontSize: 14, fontWeight: 700 }}>{t("fsAdvancedSearch")}</span>
              <button onClick={() => setShowFacets(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>
                &times;
              </button>
            </div>
            <FacetedSearch
              data={documents}
              activeFilters={facetFilters}
              onFilterChange={(newFilters) => { setFacetFilters(newFilters); setPage(0); }}
            />
          </div>
        </Suspense>
      )}

      {/* Bulk Action Bar */}
      {canBulkAction && selectedRows.size > 0 && (
        <Suspense fallback={null}>
          <BulkActionBar
            selectedCount={selectedRows.size}
            onClearSelection={() => setSelectedRows(new Set())}
            onAction={async (actionType) => {
              const docIds = Array.from(selectedRows);
              try {
                let payload = {};
                if (actionType === "update_status_approved") {
                  payload = { doc_ids: docIds, action: "update_status", payload: { status: "Aprobado" } };
                } else if (actionType === "update_status_rejected") {
                  payload = { doc_ids: docIds, action: "update_status", payload: { status: "Rechazado" } };
                } else if (actionType === "export") {
                  showToast(`Exportando ${docIds.length} documentos...`, "info");
                  setSelectedRows(new Set());
                  return;
                } else if (actionType === "assign_responsible") {
                  const resp = window.prompt("Iniciales del responsable:");
                  if (!resp) return;
                  payload = { doc_ids: docIds, action: "assign_responsible", payload: { responsible: resp } };
                } else return;

                const res = await api.post("/documents/batch", payload);
                showToast(`${res.data.success} actualizados, ${res.data.failed} fallidos`, res.data.failed > 0 ? "error" : "success");
                setSelectedRows(new Set());
                loadDocuments();
              } catch (err) {
                showToast("Error en operación masiva", "error");
              }
            }}
          />
        </Suspense>
      )}

      {/* Panel detalle */}
      {selectedDoc && (
        <DocumentDetail document={selectedDoc} columns={allColumns} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COMPONENTES AUXILIARES
   ═══════════════════════════════════════════════════════ */


function StatCard({ label, value, color }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
      whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}
      className="bg-card border border-border"
      style={{
        borderRadius: 10,
        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
        position: "relative", overflow: "hidden",
      }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: color + "18",
        border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color, fontWeight: 800, fontSize: 14,
      }}>
        <AnimatedNumber value={value} />
      </div>
      <span className="text-text-sub" style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
    </motion.div>
  );
}

function FilterInput({ label, placeholder, value, onChange, onEnter, flex, width }) {
  return (
    <div style={{ flex: flex ? 1 : undefined, minWidth: flex ? 200 : undefined, width }}>
      <label className="text-text-muted" style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
        {label}
      </label>
      <input type="text" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter && onEnter()}
        className="text-text-main border border-border"
        style={{
          width: "100%", height: 36, borderRadius: 6,
          padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
          background: "var(--bg-input, var(--bg-page))",
        }} />
    </div>
  );
}

function PagBtn({ label, onClick, disabled, active }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick} disabled={disabled}
      style={{
        padding: "3px 10px", fontSize: 11, fontWeight: active ? 700 : 500,
        borderRadius: 4,
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
        background: active ? "var(--accent)" : "var(--bg-card)",
        color: active ? "#FFF" : "var(--text-sub)",
        opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer",
      }}>
      {label}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════
   RENDERIZADO DE CELDAS
   ═══════════════════════════════════════════════════════ */

function renderCell(doc, col, t) {
  const val = doc[col];

  if (col === "Estado") {
    const displayVal = (!val || String(val).trim() === "") ? (t ? t("statusNotSent") : "Sin Enviar") : String(val);
    const s = getStatusStyle(displayVal);
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
        background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
        {displayVal.toUpperCase()}
      </span>
    );
  }

  if (col === "Crítico") {
    const sv = String(val || "").toLowerCase();
    if (sv === "sí" || sv === "si") {
      return (
        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 800, background: "#DC262618", color: "#DC2626", border: "1px solid #DC262640" }}>
          {t ? t("yes") : "SÍ"}
        </span>
      );
    }
    return (
      <span className="text-text-muted border border-border" style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "var(--bg-hover)" }}>
        {t ? t("no") : "NO"}
      </span>
    );
  }

  if (col === "Repsonsable") {
    const v = String(val || "").trim();
    if (!v) return <span className="text-text-muted">—</span>;
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "var(--accent)18", color: "var(--accent)", border: "1px solid var(--accent)30" }}>
        {v}
      </span>
    );
  }

  if (col === "Info/Review") {
    const sv = String(val || "").toUpperCase();
    if (sv === "R") return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#D9770618", color: "#D97706" }}>R</span>;
    if (sv === "I") return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: "#2563EB18", color: "#2563EB" }}>I</span>;
    return <span className="text-text-muted">—</span>;
  }

  if (col === "Días Envío" || col === "Días Devolución") {
    const n = Number(val);
    if (isNaN(n) || val === "" || val === null || val === undefined) return <span className="text-text-muted">—</span>;
    let bg = "#16A34A18", color = "#16A34A";
    if (n > 30) { bg = "#DC262618"; color = "#DC2626"; }
    else if (n > 14) { bg = "#CA8A0418"; color = "#CA8A04"; }
    else if (n > 7) { bg = "#D9770618"; color = "#D97706"; }
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: bg, color, minWidth: 36, textAlign: "center" }}>
        {n}
      </span>
    );
  }

  if (col === "Nº Revisión") {
    const n = Number(val);
    if (isNaN(n) || val === "" || val === null) return <span className="text-text-muted">—</span>;
    return <span className="text-text-sub" style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "var(--bg-hover)" }}>{n}</span>;
  }

  if (col === "Nº Doc. EIPSA") {
    return <span style={{ fontWeight: 600, color: "var(--accent)" }}>{formatCell(val)}</span>;
  }

  if (col === "Nº Pedido") {
    return <span className="text-text-sub" style={{ fontWeight: 600 }}>{formatCell(val)}</span>;
  }

  if (col === "Título") {
    const text = formatCell(val);
    return (
      <span className="text-text-sub" style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", whiteSpace: "nowrap" }}
        title={typeof val === "string" ? val : ""}>
        {text}
      </span>
    );
  }

  return <span className="text-text-sub">{formatCell(val)}</span>;
}
