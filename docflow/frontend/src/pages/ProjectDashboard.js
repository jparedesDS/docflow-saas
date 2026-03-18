import React, { useState, useEffect, useCallback } from "react";
import { useI18n } from "../contexts/I18nContext";
import api from "../services/api";

const ESTADO_COLORS = {
  Aprobado: "#16A34A",
  Enviado: "#2563EB",
  Rechazado: "#DC2626",
  "Com. Menores": "#D97706",
  "Com. Mayores": "#DB2777",
  Comentado: "#3B82F6",
};

function KpiBox({ label, value, sub, color }) {
  return (
    <div className="bg-card border border-border" style={{
      borderRadius: 10,
      padding: "16px 20px",
      flex: 1,
      minWidth: 130,
    }}>
      <p className="text-text-muted" style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <p style={{ margin: "6px 0 2px", fontSize: 26, fontWeight: 800, color: color || "var(--text-main)" }}>{value}</p>
      {sub && <p className="text-text-muted" style={{ margin: 0, fontSize: 11 }}>{sub}</p>}
    </div>
  );
}

const TIMELINE_ICONS = {
  submission: { icon: "↑", color: "#2563EB", label: "Envío" },
  return: { icon: "↩", color: "#D97706", label: "Devolución" },
  claim: { icon: "⚑", color: "#DC2626", label: "Reclamación" },
};

export default function ProjectDashboard({ onNavigateToClaims, initialPedido }) {
  const { t } = useI18n();
  const [pedidos, setPedidos] = useState([]);
  const [selectedPedido, setSelectedPedido] = useState(initialPedido || "");
  const [searchInput, setSearchInput] = useState(initialPedido || "");
  const [dashboard, setDashboard] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);

  useEffect(() => {
    api.get("/projects/list").then(r => setPedidos(r.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async (pedido) => {
    if (!pedido) return;
    setLoading(true);
    setError(null);
    try {
      const [dash, tl, docs] = await Promise.all([
        api.get(`/projects/${encodeURIComponent(pedido)}/dashboard`),
        api.get(`/projects/${encodeURIComponent(pedido)}/timeline`),
        api.get(`/projects/${encodeURIComponent(pedido)}/documents`),
      ]);
      setDashboard(dash.data);
      setTimeline(tl.data || []);
      setDocuments(docs.data || []);
    } catch (e) {
      setError(e.response?.data?.detail || "Error cargando datos del pedido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialPedido) load(initialPedido);
  }, [initialPedido, load]);

  const handleSelect = (pedido) => {
    setSelectedPedido(pedido);
    setSearchInput(pedido);
    load(pedido);
  };

  const filteredPedidos = pedidos.filter(p =>
    p.toLowerCase().includes(searchInput.toLowerCase())
  ).slice(0, 20);

  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="text-text-main">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-text-main" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          {t('pdTitle')}
        </h1>
        <p className="text-text-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
          {t('pdDesc')}
        </p>
      </div>

      {/* Selector */}
      <div style={{ position: "relative", maxWidth: 400, marginBottom: 28 }}>
        <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t('pdSelectOrder')}
        </label>
        <input
          type="text"
          value={searchInput}
          onChange={e => { setSearchInput(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          placeholder={t('pdSearchOrder')}
          className="bg-card rounded-lg border border-border text-text-main"
          style={{
            display: "block", width: "100%", marginTop: 4,
            padding: "9px 12px",
            fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
        {showDropdown && filteredPedidos.length > 0 && (
          <div className="bg-card rounded-lg border border-border" style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 50, maxHeight: 260, overflowY: "auto", marginTop: 2,
          }}>
            {filteredPedidos.map(p => (
              <div
                key={p}
                onClick={() => { handleSelect(p); setShowDropdown(false); }}
                className="text-text-main"
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 13,
                  background: p === selectedPedido ? "var(--bg-hover)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = p === selectedPedido ? "var(--bg-hover)" : "transparent"}
              >
                {p}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowDropdown(false)} />
      )}

      {loading && (
        <div className="text-text-muted" style={{ textAlign: "center", padding: 40, fontSize: 14 }}>
          {t('pdLoadingOrder')}
        </div>
      )}

      {error && (
        <div className="rounded-lg" style={{
          background: "#DC262618", border: "1px solid #DC262640",
          padding: 16, color: "#DC2626", fontSize: 13, marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {dashboard && !loading && (
        <>
          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <h2 className="text-text-main" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {dashboard.pedido}
            </h2>
            {dashboard.cliente && (
              <p className="text-text-muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                {dashboard.cliente}
              </p>
            )}
          </div>

          {/* KPIs */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
            <KpiBox label={t('total')} value={dashboard.total} />
            <KpiBox label={t('aprobado')} value={dashboard.aprobados} sub={`${dashboard.pct_aprobado}%`} color="#16A34A" />
            <KpiBox label={t('enviado')} value={dashboard.enviados} color="#2563EB" />
            <KpiBox label={t('devolutions')} value={dashboard.devueltos} color="#D97706" />
            <KpiBox label={t('notSent')} value={dashboard.sin_enviar} color="var(--text-muted)" />
            <KpiBox label={t('docsCritical')} value={dashboard.criticos} color="#DC2626" />
            <KpiBox label={t('pdAvgResponseDays')} value={dashboard.avg_dias_respuesta} sub={t('days')} />
            <KpiBox label={t('claims')} value={dashboard.claims_sent} color="#DB2777" />
          </div>

          {/* Progress bar */}
          <div className="bg-card border border-border" style={{
            borderRadius: 10, padding: "16px 20px", marginBottom: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>Progreso del pedido</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>{dashboard.pct_aprobado}%</span>
            </div>
            <div style={{ background: "var(--bg-hover)", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${dashboard.pct_aprobado}%`,
                background: "linear-gradient(90deg, #15803D, #16A34A)",
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20 }}>
            {/* Timeline */}
            <div className="bg-card border border-border" style={{
              borderRadius: 10, padding: "16px 20px",
            }}>
              <h3 className="text-text-main" style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Actividad cronológica
              </h3>
              {timeline.length === 0 ? (
                <p className="text-text-muted" style={{ fontSize: 13 }}>Sin eventos registrados</p>
              ) : (
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  {timeline.slice(0, 30).map((ev, i) => {
                    const meta = TIMELINE_ICONS[ev.type] || { icon: "·", color: "#6B7280", label: ev.type };
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: meta.color + "22",
                          color: meta.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, fontWeight: 700, flexShrink: 0,
                        }}>
                          {meta.icon}
                        </div>
                        <div>
                          <p className="text-text-main" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                            {ev.detail}
                          </p>
                          <p className="text-text-muted" style={{ margin: "1px 0 0", fontSize: 11 }}>
                            {ev.doc} {ev.date ? `· ${ev.date?.slice(0, 10)}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Documents table */}
            <div className="bg-card border border-border" style={{
              borderRadius: 10, padding: "16px 20px",
            }}>
              <h3 className="text-text-main" style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Documentos ({documents.length})
              </h3>
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr className="bg-card" style={{ position: "sticky", top: 0 }}>
                      {["Doc. EIPSA", "Título", "Rev.", "Estado"].map(h => (
                        <th key={h} className="text-text-muted" style={{
                          padding: "6px 8px", textAlign: "left",
                          borderBottom: "1px solid var(--border)",
                          fontWeight: 700,
                          textTransform: "uppercase", fontSize: 10,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d, i) => {
                      const estado = d["Estado"] || "";
                      const stateColor = ESTADO_COLORS[estado] || "#6B7280";
                      return (
                        <tr
                          key={i}
                          onClick={() => setActiveDoc(activeDoc === i ? null : i)}
                          style={{
                            cursor: "pointer",
                            background: activeDoc === i ? "var(--bg-hover)" : i % 2 === 0 ? "transparent" : "var(--bg-hover)22",
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 10, whiteSpace: "nowrap" }}>
                            {d["Nº Doc. EIPSA"] || "—"}
                          </td>
                          <td style={{ padding: "6px 8px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {d["Título"] || "—"}
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>
                            {d["Nº Revisión"] || "—"}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <span style={{
                              padding: "2px 7px", borderRadius: 4,
                              fontSize: 10, fontWeight: 600,
                              background: stateColor + "22",
                              color: stateColor,
                            }}>
                              {estado || t('statusNotSent')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {!selectedPedido && !loading && (
        <div className="card" style={{
          textAlign: "center", padding: 60,
        }}>
          <p style={{ fontSize: 28, margin: "0 0 12px" }}>📁</p>
          <p className="text-text-main" style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>
            Selecciona un pedido
          </p>
          <p className="text-text-muted" style={{ fontSize: 13, margin: 0 }}>
            Busca y selecciona un número de pedido para ver su dashboard completo
          </p>
        </div>
      )}
    </div>
  );
}
