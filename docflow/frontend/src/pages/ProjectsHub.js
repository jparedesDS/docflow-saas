import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, CheckCircle } from "@phosphor-icons/react";
import TabBar from "../components/TabBar";
import StatusGlobal from "./StatusGlobal";
import ProjectDashboard from "./ProjectDashboard";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";

export default function ProjectsHub({ canExport = false, onTabChange }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("vista-general");
  const [selectedPedido, setSelectedPedido] = useState(null);

  const TABS = useMemo(() => [
    { key: "vista-general", label: t('tabOverview') },
    { key: "seguimiento", label: t('tabTracking') },
    { key: "urgencias", label: t('tabUrgencies') },
  ], [t]);

  useEffect(() => {
    const tab = TABS.find(t => t.key === activeTab);
    onTabChange?.(tab?.label || null);
  }, [activeTab, onTabChange, TABS]);

  if (selectedPedido) {
    return (
      <div>
        <button
          onClick={() => setSelectedPedido(null)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "1px solid var(--border)",
            borderRadius: 8, padding: "6px 14px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "var(--text-sub)",
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} />
          {t('backToProjects')}
        </button>
        <ProjectDashboard initialPedido={selectedPedido} />
      </div>
    );
  }

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="projects-hub-tab" />
      <div style={{ marginTop: 20 }}>
        {activeTab === "vista-general" && (
          <StatusGlobal canExport={canExport} onSelectPedido={setSelectedPedido} />
        )}
        {activeTab === "seguimiento" && <SeguimientoTab />}
        {activeTab === "urgencias" && <UrgenciasTab />}
      </div>
    </div>
  );
}

/* Seguimiento tab — imports CurvaS + Predicciones from Analytics data */
function SeguimientoTab() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/summary").then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-text-muted" style={{ padding: 40, textAlign: "center", fontSize: 13 }}>{t('phsLoadingTracking')}</div>;
  if (!data) return <div className="text-text-muted" style={{ padding: 40, textAlign: "center", fontSize: 13 }}>{t('phsNoDataAvailable')}</div>;

  const predicciones = data?.prediccion_pedidos || [];
  const conFechas = predicciones.filter(p => p.pct_esperado != null);
  const sinFechas = predicciones.filter(p => p.pct_esperado == null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Curva S Table */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="text-text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} />
          {t('phsCurvaS')}
        </h3>
        {conFechas.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)" }}>
                  {[t('colPedido'), t('thProgress'), t('thReal'), t('thExpected'), t('thDeviation'), t('thApproved'), t('thExpectedDate')].map((h, i) => (
                    <th key={h} className="text-text-muted" style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : "center", fontWeight: 700, borderBottom: "2px solid var(--border)", fontSize: 11 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conFechas.map((p, i) => {
                  const desv = p.pct - p.pct_esperado;
                  const desvColor = desv >= 0 ? "#16A34A" : "#DC2626";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)" }}>
                      <td className="text-text-main" style={{ padding: "8px 12px", fontWeight: 700 }}>{p.pedido}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ position: "relative", height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${p.pct_esperado}%`, background: "var(--text-muted)", borderRadius: 4 }} />
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${p.pct}%`, background: "var(--accent)", borderRadius: 4, opacity: 0.85 }} />
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "var(--accent)" }}>{p.pct}%</td>
                      <td className="text-text-muted" style={{ padding: "8px 10px", textAlign: "center" }}>{p.pct_esperado}%</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: desvColor }}>{desv >= 0 ? `+${desv}` : desv}pp</td>
                      <td className="text-text-sub" style={{ padding: "8px 10px", textAlign: "center" }}>{p.aprobados}/{p.total}</td>
                      <td className="text-text-muted" style={{ padding: "8px 10px" }}>{p.fecha_prevista || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-muted" style={{ fontSize: 13, textAlign: "center", padding: 20 }}>{t('phsNoOrdersWithDates')}</p>
        )}
        {sinFechas.length > 0 && (
          <p className="text-text-muted" style={{ fontSize: 11, marginTop: 10 }}>{t('phsWithoutDates')}: {sinFechas.map(p => p.pedido).join(", ")}</p>
        )}
      </div>

      {/* Predicciones Grid */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="text-text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} />
          {t('phsPredictions')}
        </h3>
        {predicciones.filter(p => p.prediccion_fecha).length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {predicciones.filter(p => p.prediccion_fecha).map(p => {
              const semaforo = p.en_plazo === true ? "#16A34A" : p.en_plazo === false ? "#DC2626" : "#D97706";
              return (
                <div key={p.pedido} className="rounded-lg" style={{ background: "var(--bg-page)", padding: "12px 14px", border: `1px solid ${p.en_plazo === false ? "#DC262640" : "var(--border)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{p.pedido}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: semaforo }}>{p.pct}%</span>
                  </div>
                  <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p.pct}%`, background: semaforo, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-text-muted">{t('phsEstEnd')}</span>
                      <span style={{ fontWeight: 700, color: semaforo }}>{p.prediccion_fecha}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-text-muted">{t('thApproved')}</span>
                      <span className="text-text-main" style={{ fontWeight: 700 }}>{p.aprobados}/{p.total}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-text-muted" style={{ fontSize: 13, textAlign: "center", padding: 20 }}>{t('phsNoPredictions')}</p>
        )}
      </div>
    </div>
  );
}

/* Urgencias tab */
function UrgenciasTab() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/summary").then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-text-muted" style={{ padding: 40, textAlign: "center", fontSize: 13 }}>{t('loading')}</div>;

  const urgencias = data?.urgencias || [];
  const heatmap = data?.heatmap_cliente || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card" style={{ padding: 20 }}>
        <h3 className="text-text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 3, height: 16, borderRadius: 2, background: "#DC2626", display: "inline-block" }} />
          {t('phuTopUrgencies')}
        </h3>
        {urgencias.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#16A34A" }}>
            <CheckCircle size={28} weight="fill" style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, fontWeight: 600 }}>{t('phuNoUrgentDocs')}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {urgencias.map((u, i) => {
              const semaforo = u.dias > 30 ? "#DC2626" : u.dias > 15 ? "#D97706" : "#2563EB";
              return (
                <div key={i} className="rounded-lg border border-border" style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", alignItems: "start", gap: 10, padding: "10px 12px", background: "var(--bg-page)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: semaforo, marginTop: 3 }} />
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{u.doc_eipsa || u.pedido}</span>
                      {u.critico && <span style={{ fontSize: 9, background: "#DC262620", color: "#DC2626", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>{t('phuCritical')}</span>}
                    </div>
                    <p className="text-text-muted" style={{ fontSize: 11, margin: "2px 0 0" }}>{u.titulo}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                      <span className="text-text-muted" style={{ fontSize: 10 }}>{u.cliente}</span>
                      <span className="text-text-muted" style={{ fontSize: 10 }}>{u.responsable}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: semaforo }}>{u.dias}d</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Heatmap */}
      {heatmap.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 className="text-text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 3, height: 16, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} />
            {t('phuHeatmap')}
          </h3>
          <HeatmapMini data={heatmap} />
        </div>
      )}
    </div>
  );
}

function HeatmapMini({ data }) {
  const { t } = useI18n();
  const cols = ["aprobado", "enviado", "com_menores", "rechazado", "sin_enviar"];
  const colLabels = { aprobado: t('aprobado'), enviado: t('enviado'), com_menores: t('com_menores'), rechazado: t('rechazado'), sin_enviar: t('notSent') };
  const colColors = { aprobado: "#16A34A", enviado: "#2563EB", com_menores: "#D97706", rechazado: "#DC2626", sin_enviar: "#64748B" };
  const maxByCol = {};
  cols.forEach(c => { maxByCol[c] = Math.max(1, ...data.map(r => r[c] || 0)); });
  const display = data.slice(0, 15);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-hover)" }}>
            <th className="text-text-muted" style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>Cliente</th>
            {cols.map(c => (
              <th key={c} style={{ padding: "6px 8px", textAlign: "center", color: colColors[c], fontWeight: 700, borderBottom: "2px solid var(--border)", minWidth: 70 }}>{colLabels[c]}</th>
            ))}
            <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {display.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="text-text-main" style={{ padding: "5px 10px", fontWeight: 600, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.cliente}</td>
              {cols.map(c => {
                const val = row[c] || 0;
                const intensity = val / maxByCol[c];
                const bg = intensity === 0 ? "var(--bg-page)" : colColors[c] + Math.round(intensity * 255).toString(16).padStart(2, "0");
                return (
                  <td key={c} style={{ padding: "5px 8px", textAlign: "center", background: bg, fontWeight: val > 0 ? 700 : 400, color: val > 0 ? "var(--text-main)" : "var(--text-muted)", borderRadius: 4 }}>{val}</td>
                );
              })}
              <td className="text-text-sub" style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700 }}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
