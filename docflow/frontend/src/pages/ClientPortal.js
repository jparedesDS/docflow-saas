import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, CheckCircle, Clock, XCircle, MagnifyingGlass,
  X, ArrowRight, Package, CircleNotch,
} from "@phosphor-icons/react";
import api from "../services/api";
import Badge from "../components/ui/Badge";
import { formatDateISO } from "../utils/dates";

const PORTAL_ACCENT = "#4F46E5";

const TIMELINE_ICON_COLORS = {
  creation: "#4F46E5",
  planned: "#D97706",
  sent: "#0EA5E9",
  returned: "#16A34A",
  status: "#8B5CF6",
  revision: "#DB2777",
};

/* ── KPI Card ──────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: "#fff", borderRadius: 12,
      border: "1px solid #E2E8F0",
      padding: "20px 16px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    }}>
      <Icon size={20} weight="bold" style={{ color: color || PORTAL_ACCENT }} />
      <span style={{ fontSize: 28, fontWeight: 800, color: color || "#1E293B" }}>{value}</span>
      <span style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</span>
    </div>
  );
}

/* ── Order Progress Section ────────────────────────────── */

function OrderProgress({ documents }) {
  const orderGroups = useMemo(() => {
    const groups = {};
    for (const doc of documents) {
      const pedido = doc.pedido || doc.doc_eipsa?.split("-")[0] || "Sin pedido";
      if (!groups[pedido]) groups[pedido] = { total: 0, aprobados: 0 };
      groups[pedido].total += 1;
      if ((doc.estado || "").toLowerCase().includes("aprobado")) {
        groups[pedido].aprobados += 1;
      }
    }
    return Object.entries(groups)
      .map(([pedido, data]) => ({
        pedido,
        ...data,
        pct: data.total > 0 ? Math.round((data.aprobados / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [documents]);

  if (orderGroups.length === 0) return null;

  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
      padding: 20, marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Package size={16} weight="bold" style={{ color: PORTAL_ACCENT }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>Progreso por pedido</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {orderGroups.map(g => (
          <div key={g.pedido}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{g.pedido}</span>
              <span style={{ fontSize: 11, color: "#64748B" }}>
                {g.aprobados}/{g.total} aprobados ({g.pct}%)
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#E2E8F0", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${g.pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{
                  height: "100%", borderRadius: 3,
                  background: g.pct === 100
                    ? "#16A34A"
                    : `linear-gradient(90deg, ${PORTAL_ACCENT}, #6366F1)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Document Detail Drawer ────────────────────────────── */

function DocDetailDrawer({ doc, portalToken, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!doc) return;
    setLoading(true);
    api.get(`/portal/document/${encodeURIComponent(doc.doc_eipsa)}?token=${encodeURIComponent(portalToken)}`)
      .then(res => setDetail(res.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [doc, portalToken]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 49 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, x: 400 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 400 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 440, background: "#fff", overflowY: "auto",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.12)",
          borderLeft: "1px solid #E2E8F0",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #E2E8F0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>Detalle del documento</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <CircleNotch size={24} style={{ color: PORTAL_ACCENT }} />
            </motion.div>
          </div>
        ) : !detail ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            No se pudo cargar el detalle
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            {/* Document info */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1E293B", margin: "0 0 4px" }}>
                {detail.doc_eipsa}
              </h3>
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>
                {detail.titulo}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <Badge status={detail.estado || "Sin Enviar"} variant="pill" />
                {detail.tipo_doc && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: "#64748B",
                    padding: "2px 8px", borderRadius: 4, background: "#F1F5F9",
                  }}>
                    {detail.tipo_doc}
                  </span>
                )}
                {detail.revision && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: "#64748B",
                    padding: "2px 8px", borderRadius: 4, background: "#F1F5F9",
                  }}>
                    Rev. {detail.revision}
                  </span>
                )}
              </div>

              {/* Detail fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
                {[
                  { label: "Pedido", value: detail.pedido },
                  { label: "Responsable", value: detail.responsable },
                  { label: "Fecha envio", value: detail.fecha_envio ? formatDateISO(detail.fecha_envio) : null },
                  { label: "Fecha prevista", value: detail.fecha_prevista ? formatDateISO(detail.fecha_prevista) : null },
                  { label: "Fecha devolucion", value: detail.fecha_devolucion ? formatDateISO(detail.fecha_devolucion) : null },
                  { label: "Dias devolucion", value: detail.dias_devolucion },
                ].filter(f => f.value).map(f => (
                  <div key={f.label}>
                    <span style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                      {f.label}
                    </span>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", margin: "2px 0 0" }}>
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Clock size={16} weight="bold" style={{ color: PORTAL_ACCENT }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>Historial</span>
              </div>

              {(!detail.timeline || detail.timeline.length === 0) ? (
                <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: 16 }}>
                  Sin historial disponible
                </p>
              ) : (
                <div style={{ position: "relative", paddingLeft: 20 }}>
                  {/* Vertical line */}
                  <div style={{
                    position: "absolute", left: 7, top: 4, bottom: 4,
                    width: 2, background: "#E2E8F0", borderRadius: 1,
                  }} />
                  {detail.timeline.map((evt, i) => (
                    <div key={i} style={{
                      position: "relative", paddingBottom: i < detail.timeline.length - 1 ? 16 : 0,
                    }}>
                      {/* Dot */}
                      <div style={{
                        position: "absolute", left: -16, top: 4,
                        width: 10, height: 10, borderRadius: "50%",
                        background: TIMELINE_ICON_COLORS[evt.type] || "#94A3B8",
                        border: "2px solid #fff",
                        boxShadow: "0 0 0 2px #E2E8F0",
                      }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", margin: 0 }}>
                          {evt.event}
                        </p>
                        {evt.date && (
                          <p style={{ fontSize: 11, color: "#94A3B8", margin: "2px 0 0" }}>
                            {evt.date}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}

/* ── Main Portal Component ─────────────────────────────── */

export default function ClientPortal({ portalToken }) {
  const [dashboard, setDashboard] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    if (!portalToken) return;
    setLoading(true);
    Promise.allSettled([
      api.get(`/portal/dashboard?token=${encodeURIComponent(portalToken)}`),
      api.get(`/portal/documents?token=${encodeURIComponent(portalToken)}`),
    ]).then(([dashRes, docsRes]) => {
      if (dashRes.status === "fulfilled") setDashboard(dashRes.value.data);
      if (docsRes.status === "fulfilled") setDocuments(docsRes.value.data || []);
      if (dashRes.status === "rejected" && docsRes.status === "rejected") {
        setError("Token de acceso invalido o expirado");
      }
      setLoading(false);
    });
  }, [portalToken]);

  if (!portalToken) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <FolderOpen size={48} weight="thin" style={{ color: "#94A3B8", marginBottom: 16 }} />
          <h2 style={{ color: "#1E293B", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Portal de Documentos</h2>
          <p style={{ color: "#64748B", fontSize: 14 }}>Se requiere un token de acceso valido.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <XCircle size={48} weight="thin" style={{ color: "#DC2626", marginBottom: 16 }} />
          <h2 style={{ color: "#1E293B", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Acceso denegado</h2>
          <p style={{ color: "#64748B", fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
        <div style={{ textAlign: "center" }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <Clock size={32} style={{ color: PORTAL_ACCENT }} />
          </motion.div>
          <p style={{ color: "#64748B", fontSize: 14, marginTop: 12 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  const filteredDocs = documents.filter(d => {
    const matchSearch = !search ||
      (d.doc_eipsa || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.titulo || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || d.estado === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(documents.map(d => d.estado).filter(Boolean))];

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC" }}>
      {/* Header */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E2E8F0",
        padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `linear-gradient(135deg, ${PORTAL_ACCENT}, #6366F1)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFF", fontSize: 14, fontWeight: 800,
          }}>
            D
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", margin: 0 }}>
              DocFlow — Portal de Cliente
            </h1>
            {dashboard && (
              <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>{dashboard.client_name}</p>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        {/* KPIs */}
        {dashboard && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}
          >
            <KpiCard icon={FolderOpen} label="Total Docs" value={dashboard.total} />
            <KpiCard icon={CheckCircle} label="Aprobados" value={dashboard.aprobados} color="#16A34A" />
            <KpiCard icon={Clock} label="Pendientes" value={dashboard.pendientes} color="#D97706" />
            <KpiCard icon={XCircle} label="Rechazados" value={dashboard.rechazados} color="#DC2626" />
          </motion.div>
        )}

        {/* Approval rate bar */}
        {dashboard && dashboard.total > 0 && (
          <div style={{
            background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
            padding: 20, marginBottom: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Tasa de aprobacion</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: PORTAL_ACCENT }}>{dashboard.approval_rate}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "#E2E8F0", overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${dashboard.approval_rate}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${PORTAL_ACCENT}, #16A34A)` }}
              />
            </div>
          </div>
        )}

        {/* Order Progress */}
        <OrderProgress documents={documents} />

        {/* Filters */}
        <div style={{
          display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap",
        }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <MagnifyingGlass size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por documento o titulo..."
              style={{
                width: "100%", padding: "8px 12px 8px 32px",
                border: "1px solid #E2E8F0", borderRadius: 8,
                fontSize: 13, color: "#1E293B", background: "#fff",
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 8,
              fontSize: 13, color: "#1E293B", background: "#fff",
            }}
          >
            <option value="">Todos los estados</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#64748B" }}>
            {filteredDocs.length} de {documents.length} documentos
          </span>
        </div>

        {/* Documents table */}
        <div style={{
          background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0",
          overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                {["Documento", "Titulo", "Estado", "Tipo", "Revision", "Fecha Envio", "Dias Dev.", ""].map(h => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 10, fontWeight: 700, color: "#64748B",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    Sin documentos para mostrar
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc, i) => (
                  <tr key={i} style={{
                    borderBottom: "1px solid #F1F5F9",
                    cursor: "pointer",
                    transition: "background-color 0.15s",
                  }}
                    onClick={() => setSelectedDoc(doc)}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#F8FAFC"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "#1E293B" }}>
                      {doc.doc_eipsa}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#475569", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.titulo}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <Badge status={doc.estado || "Sin Enviar"} variant="pill" />
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#64748B" }}>
                      {doc.tipo_doc}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#475569", textAlign: "center" }}>
                      {doc.revision || "\u2014"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#64748B" }}>
                      {doc.fecha_envio ? formatDateISO(doc.fecha_envio) : "\u2014"}
                    </td>
                    <td style={{
                      padding: "10px 14px", fontSize: 12, fontWeight: 600, textAlign: "center",
                      color: parseFloat(doc.dias_devolucion) > 15 ? "#DC2626" : parseFloat(doc.dias_devolucion) > 7 ? "#D97706" : "#64748B",
                    }}>
                      {doc.dias_devolucion || "\u2014"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ArrowRight size={14} style={{ color: "#94A3B8" }} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 11 }}>
          Portal de documentos proporcionado por DocFlow — Solo lectura
        </div>
      </main>

      {/* Document Detail Drawer */}
      <AnimatePresence>
        {selectedDoc && (
          <DocDetailDrawer
            doc={selectedDoc}
            portalToken={portalToken}
            onClose={() => setSelectedDoc(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
