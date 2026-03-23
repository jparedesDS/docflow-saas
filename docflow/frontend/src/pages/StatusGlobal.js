import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import { ArrowClockwise, DownloadSimple, Copy, CheckCircle, ArrowUUpLeft, PaperPlaneTilt, ClockCountdown, FolderSimple, ArrowSquareOut } from "@phosphor-icons/react";
import ProjectPreviewPopover from "../components/ProjectPreviewPopover";
import { API_BASE } from "../config";
import { STATUS_COLORS as STATUS_COLORS_INLINE } from "../constants/status";
import { diasDesde } from "../utils/dates";
import { useI18n } from "../contexts/I18nContext";

/* ═══════════════════════════════════════════════════════
   STATUS GLOBAL + MONITORING REPORT (página unificada)
   ═══════════════════════════════════════════════════════ */

function normalizePedido(val) {
  return String(val || "").trim().toLowerCase().replace(/-s\d+$/i, "");
}

export default function StatusGlobal({ canExport = false, onSelectPedido }) {
  const { t } = useI18n();
  const { showToast } = useToast();

  const COLORS = useMemo(() => ({
    aprobados:  { bar: "#16A34A", label: t("approved") },
    pendientes: { bar: "#D97706", label: t("pending") },
    rechazados: { bar: "#DC2626", label: t("rejected") },
    comentados: { bar: "#CA8A04", label: t("comentado") },
  }), [t]);
  const [statusData, setStatusData] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [expandedDocs, setExpandedDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [colFilters, setColFilters] = useState({ pedido: "", cliente: "", npo: "", noferta: "", material: "" });
  const [copying, setCopying] = useState(false);
  const [copyMsg, setCopyMsg] = useState(null);
  const [expandSort, setExpandSort] = useState({});
  const [expandFilter, setExpandFilter] = useState({});
  const debounceRef = useRef(null);
  const [hoveredPedido, setHoveredPedido] = useState(null);
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const hoverTimerRef = useRef(null);
  const graceTimerRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, reportRes] = await Promise.all([
        api.get("/documents/monitoring/status-global"),
        api.get("/reports/monitoring-report").then(r => r.data).catch(() => null),
      ]);
      setStatusData(statusRes.data);
      setReportData(reportRes);
    } catch (err) {
      console.error("Error cargando datos:", err);
      showToast("Error al cargar datos", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedFilter(filter), 300);
    return () => clearTimeout(debounceRef.current);
  }, [filter]);

  const toggleExpand = async (pedido) => {
    if (expanded === pedido) {
      setExpanded(null);
      setExpandedDocs([]);
      return;
    }
    setExpanded(pedido);
    setLoadingDocs(true);
    try {
      const res = await api.get("/documents/monitoring", { params: { pedido } });
      setExpandedDocs(res.data);
    } catch (err) {
      console.error("Error cargando docs del pedido:", err);
      showToast("Error al cargar documentos del pedido", "error");
      setExpandedDocs([]);
    }
    setLoadingDocs(false);
  };

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

  const handlePedidoHoverEnter = useCallback((pedidoData, el) => {
    clearTimeout(graceTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredPedido(pedidoData);
      setPopoverAnchor(el);
    }, 400);
  }, []);

  const handlePedidoHoverLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    graceTimerRef.current = setTimeout(() => {
      setHoveredPedido(null);
      setPopoverAnchor(null);
    }, 200);
  }, []);

  const handlePopoverEnter = useCallback(() => {
    clearTimeout(graceTimerRef.current);
  }, []);

  const handlePopoverLeave = useCallback(() => {
    setHoveredPedido(null);
    setPopoverAnchor(null);
  }, []);

  const pedidosPorSeccion = useMemo(() => {
    if (!reportData) return {};
    const getPedidos = (arr) => new Set((arr || []).map(d => normalizePedido(d["Nº Pedido"])));
    return {
      enviados:     getPedidos(reportData.enviados),
      devoluciones: getPedidos(reportData.devoluciones),
      criticos:     getPedidos(reportData.criticos),
      criticos_15d: getPedidos(reportData.criticos_15d),
      sin_enviar:   getPedidos(reportData.sin_enviar),
    };
  }, [reportData]);

  const devBreakdown = useMemo(() => {
    if (!reportData?.devoluciones) return { rechazados: 0, com_menores: 0, com_mayores: 0, comentado: 0 };
    const arr = reportData.devoluciones;
    return {
      rechazados:  arr.filter(d => d["Estado"] === "Rechazado").length,
      com_menores: arr.filter(d => d["Estado"] === "Com. Menores").length,
      com_mayores: arr.filter(d => d["Estado"] === "Com. Mayores").length,
      comentado:   arr.filter(d => d["Estado"] === "Comentado").length,
    };
  }, [reportData]);

  const critsByPedido = useMemo(() => {
    if (!reportData) return null;
    const arr = (reportData.criticos || []).filter(d =>
      String(d["Estado"] || "").toLowerCase() !== "enviado"
    );
    const map = {};
    for (const doc of arr) {
      const p = normalizePedido(doc["Nº Pedido"]);
      map[p] = (map[p] || 0) + 1;
    }
    return map;
  }, [reportData]);

  const filteredStatus = useMemo(() => {
    let rows = statusData;
    if (activeSection === "aprobados") {
      rows = rows.filter(r => r.aprobados > 0);
    } else if (activeSection !== null) {
      const allowed = pedidosPorSeccion[activeSection] || new Set();
      rows = rows.filter(r => allowed.has(normalizePedido(r.pedido)));
    }
    if (debouncedFilter) {
      const q = debouncedFilter.toLowerCase();
      rows = rows.filter(r =>
        ["pedido", "cliente", "npo", "noferta", "material"].some(k => String(r[k] || "").toLowerCase().includes(q))
      );
    }
    for (const [key, val] of Object.entries(colFilters)) {
      if (val.trim()) {
        const q = val.trim().toLowerCase();
        rows = rows.filter(r => String(r[key] || "").toLowerCase().includes(q));
      }
    }
    return rows;
  }, [statusData, activeSection, pedidosPorSeccion, debouncedFilter, colFilters]);

  const filteredExpandedDocs = useMemo(() => {
    if (activeSection === null) return expandedDocs;
    return expandedDocs.filter(doc => {
      const estado = String(doc["Estado"] || "").trim();
      const estadoL = estado.toLowerCase();
      const critico = String(doc["Crítico"] || "").toLowerCase();
      if (activeSection === "aprobados") return estadoL === "aprobado";
      if (activeSection === "enviados") return estadoL === "enviado";
      if (activeSection === "devoluciones") return ["Com. Menores", "Com. Mayores", "Rechazado", "Comentado"].includes(estado);
      if (activeSection === "sin_enviar") return !estado || estado === "Sin Enviar";
      return true;
    });
  }, [expandedDocs, activeSection]);

  const kpis = reportData?.kpis || {};

  const totals = filteredStatus.reduce((acc, p) => ({
    docs: acc.docs + p.total,
    aprobados: acc.aprobados + p.aprobados,
    criticos: acc.criticos + p.criticos,
  }), { docs: 0, aprobados: 0, criticos: 0 });

  const globalPct = kpis.pct_completado !== undefined
    ? kpis.pct_completado
    : (totals.docs > 0 ? Math.round((totals.aprobados / totals.docs) * 100) : 0);

  if (loading) return <SkeletonLoader />;

  const CATEGORY_CARDS = [
    {
      key: "aprobados",
      label: t("approved"),
      value: kpis.aprobados ?? totals.aprobados,
      color: "#16A34A",
      Icon: CheckCircle,
      sub: `${kpis.pct_completado ?? globalPct}% ${t("docsCompletedPct")}`,
    },
    {
      key: "devoluciones",
      label: t("devolutions"),
      value: kpis.devoluciones ?? 0,
      color: "#D97706",
      Icon: ArrowUUpLeft,
      breakdown: [
        { label: t("rechazado"),   value: devBreakdown.rechazados,  color: "#DC2626" },
        { label: t("com_menores"), value: devBreakdown.com_menores, color: "#D97706" },
        { label: t("com_mayores"), value: devBreakdown.com_mayores, color: "#DB2777" },
        { label: t("comentado"),   value: devBreakdown.comentado,   color: "#CA8A04" },
      ],
    },
    {
      key: "enviados",
      label: t("sent"),
      value: kpis.enviados ?? 0,
      color: "#2563EB",
      Icon: PaperPlaneTilt,
      sub: t("sgWaitingClient"),
    },
    {
      key: "sin_enviar",
      label: t("notSent"),
      value: kpis.sin_enviar ?? 0,
      color: "#71717A",
      Icon: ClockCountdown,
      sub: t("sgPendingSend"),
    },
  ];

  return (
    <div className="space-y-4">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <PageHeader title={t("sgTitle")} description={t("sgDesc")} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={loadData} disabled={loading}
            className="bg-card rounded-lg border border-border text-text-sub" style={{
              padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}>
            <ArrowClockwise size={14} />
            {loading ? t("loading") : t("update")}
          </motion.button>
          {canExport && (
            <>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleDownloadExcel} disabled={!reportData}
                className="rounded-lg"
                style={{
                  padding: "7px 16px", border: "none",
                  background: "#16A34A", color: "#FFF", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}>
                <DownloadSimple size={14} />
                {t("sgDownloadExcel")}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleCopyShared} disabled={!reportData || copying}
                className="rounded-lg"
                style={{
                  padding: "7px 16px", border: "none",
                  background: "var(--accent)", color: "#FFF", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}>
                <Copy size={14} />
                {copying ? t("sgCopying") : t("sgCopyToShared")}
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Progreso global */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="text-text-sub" style={{ fontSize: 11, fontWeight: 600 }}>{t("sgGlobalProgress")}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: globalPct >= 75 ? "#16A34A" : globalPct >= 50 ? "#D97706" : "#DC2626" }}>
            {globalPct}%
          </span>
        </div>
        <ProgressBar pct={globalPct} height={10} />
      </div>

      {/* Toast copy */}
      <AnimatePresence>
        {copyMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-lg"
            style={{
              padding: "10px 16px",
              background: copyMsg.startsWith("Error") ? "#DC262618" : "#16A34A18",
              color: copyMsg.startsWith("Error") ? "#DC2626" : "#16A34A",
              border: `1px solid ${copyMsg.startsWith("Error") ? "#DC262640" : "#16A34A40"}`,
              fontSize: 13, fontWeight: 600,
            }}>
            {copyMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 Category Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {CATEGORY_CARDS.map((card) => {
          const isActive = activeSection === card.key;
          return (
            <motion.div
              key={card.key}
              whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setActiveSection(isActive ? null : card.key); setExpanded(null); setExpandedDocs([]); }}
              className="rounded-xl"
              style={{
                background: isActive ? `${card.color}12` : "var(--bg-card)",
                border: `1px solid ${isActive ? `${card.color}40` : "var(--border)"}`,
                borderTop: `3px solid ${card.color}`,
                padding: "14px 16px",
                cursor: "pointer",
                boxShadow: isActive ? `0 0 0 2px ${card.color}40` : "none",
                transition: "all 0.15s",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {card.label}
                </span>
                <card.Icon size={18} weight="fill" style={{ color: card.color, opacity: 0.8 }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: card.color, lineHeight: 1, marginBottom: 8, fontFamily: "monospace" }}>
                {card.value ?? 0}
              </div>
              {card.breakdown ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {card.breakdown.map(b => (
                    <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                      <span className="text-text-muted" style={{ fontSize: 10 }}>{b.label}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: b.color }}>{b.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-text-muted" style={{ fontSize: 11 }}>{card.sub}</span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Buscador */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
              placeholder={t("sgGlobalSearch")}
              className="input-field"
              style={{ paddingLeft: 32, width: 240 }} />
            <svg className="text-text-muted" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          {Object.values(colFilters).some(v => v) && (
            <button
              onClick={() => setColFilters({ pedido: "", cliente: "", npo: "", noferta: "", material: "" })}
              style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #DC262640", background: "#DC262618", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              {t("sgClearFilters")}
            </button>
          )}
        </div>
        <span className="text-text-muted" style={{ fontSize: 11 }}>{filteredStatus.length} {t("orders")}</span>
      </div>

      {/* Tabla de pedidos */}
      <div className="bg-card border border-border" style={{
        borderRadius: 10, overflow: "hidden",
      }}>
        <table className="w-full border-collapse" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-sidebar)" }}>
              {[
                { label: "", w: 36, center: true },
                { label: "Pedido", w: null, center: false },
                { label: "Cliente", w: null, center: false },
                { label: "Nº PO", w: null, center: false },
                { label: "Nº Oferta", w: null, center: false },
                { label: "Material", w: null, center: false },
                { label: "Docs", w: 56, center: true },
                { label: "Progreso", w: 220, center: false },
                { label: "Estado", w: null, center: true },
                { label: "Crít.", w: 60, center: true },
              ].map((h, i) => (
                <th key={i} className="text-text-muted" style={{
                  padding: "10px 12px", fontWeight: 700,
                  fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase",
                  whiteSpace: "nowrap", textAlign: h.center ? "center" : "left",
                  width: h.w || undefined,
                  borderRight: i < 9 ? "1px solid var(--border)" : "none",
                  paddingLeft: i === 0 ? 8 : 12,
                }}>
                  {h.label}
                </th>
              ))}
            </tr>
            {/* Fila de filtros por columna */}
            <tr style={{ background: "var(--bg-hover)", borderBottom: "2px solid var(--border)" }}>
              <td style={{ padding: "4px 6px", borderRight: "1px solid var(--border)" }} />
              {[
                { key: "pedido",   placeholder: t("sgFilterPedido") },
                { key: "cliente",  placeholder: t("sgFilterCliente") },
                { key: "npo",      placeholder: t("sgFilterPO") },
                { key: "noferta",  placeholder: t("sgFilterOferta") },
                { key: "material", placeholder: t("sgFilterMaterial") },
              ].map(({ key, placeholder }) => (
                <td key={key} style={{ padding: "4px 8px", borderRight: "1px solid var(--border)" }}>
                  <input
                    value={colFilters[key]}
                    onChange={e => setColFilters(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="text-text-main"
                    style={{
                      width: "100%", padding: "3px 7px", fontSize: 11,
                      border: colFilters[key] ? "1px solid var(--accent)" : "1px solid var(--border)",
                      borderRadius: 5, outline: "none",
                      background: colFilters[key] ? "var(--accent)12" : "var(--bg-input, var(--bg-page))",
                    }}
                  />
                </td>
              ))}
              {[...Array(4)].map((_, i) => (
                <td key={i} style={{ borderRight: i < 3 ? "1px solid var(--border)" : "none" }} />
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStatus.map((p, i) => {
              const isExp = expanded === p.pedido;
              const pct = p.pct_completado;
              const healthColor = pct >= 75 ? "#16A34A" : pct >= 50 ? "#D97706" : pct >= 25 ? "#CA8A04" : "#DC2626";
              return (
                <React.Fragment key={p.pedido}>
                  <tr
                    onClick={() => toggleExpand(p.pedido)}
                    style={{
                      background: isExp ? "var(--accent)0A" : i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)",
                      cursor: "pointer", borderBottom: "1px solid var(--border)",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => {
                      if (!isExp) e.currentTarget.style.background = "var(--bg-hover)";
                      if (onSelectPedido) {
                        const anchor = e.currentTarget.querySelector(".pedido-name");
                        if (anchor) handlePedidoHoverEnter(p, anchor);
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isExp) e.currentTarget.style.background = i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)";
                      handlePedidoHoverLeave();
                    }}>

                    <td style={{ padding: "8px 6px", width: 36, textAlign: "center", borderLeft: `3px solid ${healthColor}` }}>
                      <svg style={{
                        width: 13, height: 13, color: isExp ? "var(--accent)" : "var(--text-muted)",
                        transform: isExp ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s",
                      }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>

                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      <span
                        className="pedido-name"
                        onClick={(e) => { if (onSelectPedido) { e.stopPropagation(); onSelectPedido(p.pedido); }}}
                        onMouseEnter={(e) => {
                          if (onSelectPedido) {
                            e.currentTarget.style.textDecoration = "underline";
                            const icon = e.currentTarget.querySelector(".pedido-link-icon");
                            if (icon) icon.style.opacity = "1";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = "none";
                          const icon = e.currentTarget.querySelector(".pedido-link-icon");
                          if (icon) icon.style.opacity = "0.4";
                        }}
                        style={{
                          fontWeight: 700, color: "var(--accent)", fontSize: 13,
                          cursor: onSelectPedido ? "pointer" : "default",
                          textDecoration: "none",
                          transition: "text-decoration 0.15s",
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}
                      >
                        {p.pedido}
                        {onSelectPedido && (
                          <ArrowSquareOut size={12} weight="bold" className="pedido-link-icon"
                            style={{ opacity: 0.4, transition: "opacity 0.15s" }} />
                        )}
                      </span>
                      {p.suplementos > 0 && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, fontWeight: 700,
                          padding: "1px 5px", borderRadius: 4,
                          background: "var(--accent)1A", color: "var(--accent)", border: "1px solid var(--accent)40",
                        }} title={p.suplementos_detalle?.join(", ")}>
                          +{p.suplementos}S
                        </span>
                      )}
                    </td>

                    <td className="text-text-sub" style={{ padding: "8px 12px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }} title={p.cliente}>
                      {p.cliente || <span className="text-text-muted">—</span>}
                    </td>

                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      {p.npo
                        ? <span className="text-text-sub border border-border" style={{ fontFamily: "monospace", fontSize: 11, background: "var(--bg-hover)", padding: "2px 7px", borderRadius: 4 }}>{p.npo}</span>
                        : <span className="text-text-muted">—</span>}
                    </td>

                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      {p.noferta
                        ? <span className="text-text-sub border border-border" style={{ fontFamily: "monospace", fontSize: 11, background: "var(--bg-hover)", padding: "2px 7px", borderRadius: 4 }}>{p.noferta}</span>
                        : <span className="text-text-muted">—</span>}
                    </td>

                    <td className="text-text-muted" style={{ padding: "8px 12px", whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", fontSize: 11 }} title={p.material}>
                      {p.material || <span className="text-text-muted">—</span>}
                    </td>

                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span className="text-text-main" style={{ fontWeight: 700, fontSize: 13 }}>{p.total}</span>
                    </td>

                    <td style={{ padding: "10px 16px", minWidth: 200, background: healthColor + "07" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <ProgressBar pct={pct} height={16} />
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 900, minWidth: 46, textAlign: "right", color: healthColor, letterSpacing: "-0.5px", lineHeight: 1 }}>
                          {pct}%
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: "8px 12px", textAlign: "center", minWidth: 130 }}>
                      <span style={{
                        display: "inline-block", fontSize: 10, fontWeight: 700,
                        padding: "3px 10px", borderRadius: 99, marginBottom: 5,
                        background: healthColor + "18", color: healthColor,
                        border: `1px solid ${healthColor}33`, whiteSpace: "nowrap",
                      }}>
                        {pct >= 75 ? t("sgOnTrack") : pct >= 50 ? t("sgInProgress") : pct >= 25 ? t("sgAttention") : t("sgUrgent")}
                      </span>
                      <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap" }}>
                        {p.aprobados > 0 && <MicroBadge value={`${p.aprobados}`} bg="#16A34A18" color="#16A34A" title={t("approved")} />}
                        {p.sin_enviar > 0 && <MicroBadge value={`${p.sin_enviar}`} bg="#71717A18" color="#71717A" title={t("notSent")} />}
                        {p.pendientes > 0 && <MicroBadge value={`${p.pendientes}`} bg="#D9770618" color="#D97706" title={t("pending")} />}
                        {p.reclamados > 0 && <MicroBadge value={`${p.reclamados}`} bg="#DC262618" color="#DC2626" title={t("rejected")} />}
                        {p.comentados > 0 && <MicroBadge value={`${p.comentados}`} bg="#CA8A0418" color="#CA8A04" title={t("comentado")} />}
                      </div>
                    </td>

                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      {(() => {
                        const n = critsByPedido
                          ? (critsByPedido[normalizePedido(p.pedido)] || 0)
                          : p.criticos;
                        return n > 0 ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 28, height: 22, borderRadius: 5,
                            fontSize: 13, fontWeight: 800, background: "#DC262618", color: "#DC2626",
                            border: "1px solid #DC262640",
                          }}>{n}</span>
                        ) : (
                          <span className="text-text-muted" style={{ fontSize: 11 }}>—</span>
                        );
                      })()}
                    </td>

                  </tr>

                  {isExp && (
                    <tr>
                      <td colSpan={10} style={{ padding: 0, borderBottom: `2px solid ${healthColor}66` }}>
                        <ExpandedDocs
                      docs={filteredExpandedDocs}
                      loading={loadingDocs}
                      activeSection={activeSection}
                      pedido={p.pedido}
                      expandSort={expandSort}
                      setExpandSort={setExpandSort}
                      expandFilter={expandFilter}
                      setExpandFilter={setExpandFilter}
                      t={t}
                    />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredStatus.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <FolderSimple size={48} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px", display: "block", opacity: 0.5 }} />
            <p className="text-text-main" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t("sgNoOrders")}</p>
            <p className="text-text-muted" style={{ fontSize: 12 }}>
              {debouncedFilter || Object.values(colFilters).some(v => v)
                ? t("sgAdjustFilters")
                : t("sgNoActiveOrders")}
            </p>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 justify-center">
        {Object.entries(COLORS).map(([key, c]) => (
          <div key={key} className="text-text-muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: c.bar }} />
            {c.label}
          </div>
        ))}
      </div>

      {/* Hover Preview Popover */}
      <AnimatePresence>
        {hoveredPedido && popoverAnchor && onSelectPedido && (
          <ProjectPreviewPopover
            pedido={hoveredPedido}
            anchor={popoverAnchor}
            onNavigate={() => { onSelectPedido(hoveredPedido.pedido); setHoveredPedido(null); }}
            onMouseEnter={handlePopoverEnter}
            onMouseLeave={handlePopoverLeave}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COMPONENTES AUXILIARES
   ═══════════════════════════════════════════════════════ */

/* KpiCard removed — use ui/KpiCard for future additions */

function ProgressBar({ pct, height = 8 }) {
  const color = pct >= 75 ? "#16A34A" : pct >= 50 ? "#D97706" : pct >= 25 ? "#CA8A04" : "#DC2626";
  return (
    <div style={{
      flex: 1, height, background: "var(--border)", borderRadius: height, overflow: "hidden",
    }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: "100%", borderRadius: height, background: `linear-gradient(90deg, ${color}CC, ${color})` }}
      />
    </div>
  );
}

function MicroBadge({ value, bg, color, title }) {
  return (
    <span title={title} style={{
      display: "inline-block", padding: "2px 6px", borderRadius: 3,
      fontSize: 10, fontWeight: 700, background: bg, color, lineHeight: "14px",
    }}>
      {value}
    </span>
  );
}

function DaysBadge({ days }) {
  if (!days || days === 0) return <span className="text-text-muted">—</span>;
  let bg = "#16A34A18", color = "#16A34A";
  if (days > 30) { bg = "#DC262618"; color = "#DC2626"; }
  else if (days > 14) { bg = "#CA8A0418"; color = "#CA8A04"; }
  else if (days > 7) { bg = "#D9770618"; color = "#D97706"; }
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 700, background: bg, color }}>
      {days}d
    </span>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-4">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
        {[...Array(7)].map((_, i) => <SkeletonCard key={i} height={64} />)}
      </div>
      <SkeletonCard height={64} />
      <div className="border border-border" style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: 10, overflow: "hidden" }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid var(--border)" }}>
            {[...Array(8)].map((_, j) => <SkeletonCard key={j} height={14} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TABLA EXPANDIDA DE DOCUMENTOS DEL PEDIDO
   ═══════════════════════════════════════════════════════ */

function getExpandCols(t) {
  return [
    { key: "Nº Pedido",       label: "Sup.",              align: "center" },
    { key: "Nº Doc. EIPSA",   label: t("colDocEipsa"),    align: "left" },
    { key: "Nº Doc. Cliente", label: "Nº Doc. Cliente",   align: "left" },
    { key: "Título",          label: t("colTitle"),        align: "left" },
    { key: "Tipo Doc.",       label: t("colType"),         align: "center" },
    { key: "Crítico",         label: t("colCritical"),     align: "center" },
    { key: "Estado",          label: t("colStatus"),       align: "center" },
    { key: "Nº Revisión",     label: t("colRev"),          align: "center" },
    { key: "Fecha Env. Doc.", label: t("colSentDate"),     align: "center" },
    { key: "_dias_transcurridos", label: t("days"),        align: "center" },
    { key: "Repsonsable",     label: t("filterResponsible"), align: "left" },
  ];
}


function getInlineStatusStyle(status) {
  const n = (status || "").toLowerCase().trim().replace(/[\s.]+/g, "_");
  for (const [key, style] of Object.entries(STATUS_COLORS_INLINE)) {
    if (n.includes(key)) return style;
  }
  return { bg: "var(--bg-hover)", color: "var(--text-muted)", border: "var(--border)" };
}

function sortDocs(docs, sortState) {
  if (!sortState?.col) return docs;
  const { col, dir } = sortState;
  return [...docs].sort((a, b) => {
    let va = a[col] ?? '';
    let vb = b[col] ?? '';
    if (col === '_dias_transcurridos') {
      va = diasDesde(a["Fecha Env. Doc."]) ?? 0;
      vb = diasDesde(b["Fecha Env. Doc."]) ?? 0;
      return dir === 'asc' ? va - vb : vb - va;
    }
    if (col === 'Fecha Env. Doc.') {
      va = va ? new Date(String(va).split("T")[0]).getTime() : 0;
      vb = vb ? new Date(String(vb).split("T")[0]).getTime() : 0;
      return dir === 'asc' ? va - vb : vb - va;
    }
    if (col === 'Nº Revisión') {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return dir === 'asc' ? va - vb : vb - va;
    }
    va = String(va).toLowerCase();
    vb = String(vb).toLowerCase();
    return dir === 'asc' ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es');
  });
}

function ExpandedDocs({ docs, loading, activeSection, pedido, expandSort, setExpandSort, expandFilter, setExpandFilter, t }) {
  const EXPAND_COLS = getExpandCols(t);

  if (loading) {
    return (
      <div style={{ padding: "16px 16px 16px 52px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--accent)", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
        <span className="text-text-muted" style={{ fontSize: 11 }}>{t("sgLoadingDocsEllipsis")}</span>
      </div>
    );
  }

  if (!docs.length) {
    return (
      <div className="text-text-muted" style={{ padding: "14px 16px 14px 52px", fontSize: 11, fontStyle: "italic" }}>
        {activeSection !== null ? t("sgNoDocsInSection") : t("sgNoDocuments")}
      </div>
    );
  }

  const filterText = expandFilter[pedido] || '';
  let visibleDocs = docs;
  if (filterText.trim()) {
    const q = filterText.toLowerCase();
    visibleDocs = visibleDocs.filter(doc =>
      EXPAND_COLS.some(c => String(doc[c.key] ?? '').toLowerCase().includes(q))
    );
  }
  visibleDocs = sortDocs(visibleDocs, expandSort[pedido]);

  return (
    <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-page)" }}>
      {/* Barra de filtro */}
      <div style={{ padding: "8px 16px 4px 52px", display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="text"
          placeholder={t("sgFilterDocs")}
          value={filterText}
          onChange={e => setExpandFilter(prev => ({ ...prev, [pedido]: e.target.value }))}
          className="text-text-main"
          style={{
            fontSize: 13, padding: "4px 10px", borderRadius: 6,
            border: filterText ? "1px solid var(--accent)" : "1px solid var(--border)",
            background: "var(--bg-input, var(--bg-card))",
            width: 220, outline: "none",
          }}
        />
        {filterText && (
          <button
            onClick={() => setExpandFilter(prev => ({ ...prev, [pedido]: '' }))}
            style={{ fontSize: 11, color: "#94A3B8", background: "none", border: "none", cursor: "pointer" }}>
            ✕ Limpiar
          </button>
        )}
        <span style={{ fontSize: 11, color: "#64748B", marginLeft: "auto" }}>
          {visibleDocs.length} / {docs.length} docs
        </span>
      </div>
      <div style={{ padding: "0 0 0 52px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "var(--bg-hover)" }}>
              {EXPAND_COLS.map((c) => {
                const s = expandSort[pedido];
                const isActive = s?.col === c.key;
                return (
                  <th key={c.key}
                    onClick={() => setExpandSort(prev => ({
                      ...prev,
                      [pedido]: {
                        col: c.key,
                        dir: isActive && prev[pedido]?.dir === 'asc' ? 'desc' : 'asc',
                      }
                    }))}
                    style={{
                      padding: "7px 10px", textAlign: c.align,
                      fontSize: 9, fontWeight: 700,
                      color: isActive ? "var(--accent)" : "var(--text-muted)",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                      cursor: "pointer", userSelect: "none",
                    }}>
                    {c.label}{isActive ? (s.dir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleDocs.map((doc, i) => (
              <tr key={i} style={{
                background: i % 2 === 0 ? "var(--bg-page)" : "var(--bg-card)",
                borderBottom: "1px solid var(--border)",
                transition: "background 0.12s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "var(--bg-page)" : "var(--bg-card)"}>
                {EXPAND_COLS.map((c) => (
                  <td key={c.key} style={{ padding: "6px 10px", textAlign: c.align, whiteSpace: c.key === "Título" ? "normal" : "nowrap", verticalAlign: "middle" }}>
                    {renderExpandCell(doc, c.key, t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderExpandCell(doc, key, t) {
  const val = doc[key];

  if (key === "_dias_transcurridos") {
    const n = diasDesde(doc["Fecha Env. Doc."]);
    if (n === null) return <span className="text-text-muted">—</span>;
    let bg = "#16A34A18", color = "#16A34A";
    if (n > 30) { bg = "#DC262618"; color = "#DC2626"; }
    else if (n > 14) { bg = "#CA8A0418"; color = "#CA8A04"; }
    else if (n > 7)  { bg = "#D9770618"; color = "#D97706"; }
    return (
      <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: bg, color }}>
        {n}d
      </span>
    );
  }

  if (key === "Repsonsable") {
    if (!val) return <span className="text-text-muted">—</span>;
    return <span className="text-text-sub" style={{ fontSize: 11, fontWeight: 600 }}>{String(val)}</span>;
  }

  if (key === "Estado") {
    const displayVal = (!val || String(val).trim() === "") ? (t ? t("statusNotSent") : "Sin Enviar") : String(val);
    const s = getInlineStatusStyle(displayVal);
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
        {displayVal.toUpperCase()}
      </span>
    );
  }

  if (key === "Crítico") {
    const sv = String(val || "").toLowerCase();
    if (sv === "sí" || sv === "si") {
      return <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 800, background: "#DC262618", color: "#DC2626" }}>{t ? t("yes") : "SÍ"}</span>;
    }
    return <span className="text-text-muted" style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, background: "var(--bg-hover)" }}>{t ? t("no") : "NO"}</span>;
  }

  if (key === "Días Envío") {
    const n = Number(val);
    if (isNaN(n) || !val) return <span className="text-text-muted">—</span>;
    let bg = "#16A34A18", color = "#16A34A";
    if (n > 30) { bg = "#DC262618"; color = "#DC2626"; }
    else if (n > 14) { bg = "#CA8A0418"; color = "#CA8A04"; }
    else if (n > 7) { bg = "#D9770618"; color = "#D97706"; }
    return <span style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, background: bg, color }}>{n}</span>;
  }

  if (key === "Nº Pedido") {
    const raw = String(val || "");
    const match = raw.match(/-s(\d{1,3})$/i);
    if (match) {
      return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3, background: "#2563EB18", color: "#2563EB" }}>S{match[1].padStart(2, "0")}</span>;
    }
    return <span className="text-text-muted" style={{ fontSize: 10 }}>—</span>;
  }

  if (key === "Tipo Doc.") {
    if (!val) return <span className="text-text-muted">—</span>;
    return <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#2563EB12", color: "#2563EB", border: "1px solid #2563EB30", whiteSpace: "nowrap" }}>{String(val)}</span>;
  }

  if (key === "Nº Doc. EIPSA") {
    return <span style={{ fontWeight: 700, color: "#2563EB", fontSize: 11 }}>{String(val || "—")}</span>;
  }

  if (key === "Nº Doc. Cliente") {
    if (!val) return <span className="text-text-muted">—</span>;
    return <span className="text-text-sub" style={{ fontWeight: 600, fontSize: 11 }}>{String(val)}</span>;
  }

  if (key === "Título") {
    const text = String(val || "—");
    return <span className="text-text-sub" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", whiteSpace: "nowrap" }} title={text}>{text}</span>;
  }

  if (key === "Nº Revisión") {
    const n = Number(val);
    if (isNaN(n) || !val) return <span className="text-text-muted">—</span>;
    return <span className="text-text-sub" style={{ padding: "2px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, background: "var(--bg-hover)" }}>{n}</span>;
  }

  if (key === "Fecha Env. Doc.") {
    const s = String(val || "");
    if (!s) return <span className="text-text-muted">—</span>;
    const clean = s.includes("T") ? s.split("T")[0] : s;
    return <span className="text-text-sub">{clean}</span>;
  }

  return <span className="text-text-sub">{String(val || "—")}</span>;
}
