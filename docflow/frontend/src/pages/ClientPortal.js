import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen, CheckCircle, Clock, XCircle, MagnifyingGlass,
} from "@phosphor-icons/react";
import api from "../services/api";
import Badge from "../components/ui/Badge";

const PORTAL_ACCENT = "#4F46E5";

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

export default function ClientPortal({ portalToken }) {
  const [dashboard, setDashboard] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
        setError("Token de acceso inválido o expirado");
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
          <p style={{ color: "#64748B", fontSize: 14 }}>Se requiere un token de acceso válido.</p>
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
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Tasa de aprobación</span>
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

        {/* Filters */}
        <div style={{
          display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap",
        }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <MagnifyingGlass size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por documento o título..."
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
                {["Documento", "Título", "Estado", "Tipo", "Revisión", "Fecha Envío", "Días Dev."].map(h => (
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
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                    Sin documentos para mostrar
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc, i) => (
                  <tr key={i} style={{
                    borderBottom: "1px solid #F1F5F9",
                    transition: "background-color 0.15s",
                  }}
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
                      {doc.revision || "—"}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#64748B" }}>
                      {doc.fecha_envio ? doc.fecha_envio.split("T")[0] : "—"}
                    </td>
                    <td style={{
                      padding: "10px 14px", fontSize: 12, fontWeight: 600, textAlign: "center",
                      color: parseFloat(doc.dias_devolucion) > 15 ? "#DC2626" : parseFloat(doc.dias_devolucion) > 7 ? "#D97706" : "#64748B",
                    }}>
                      {doc.dias_devolucion || "—"}
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
    </div>
  );
}
