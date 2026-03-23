import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowClockwise, Warning, Clock, CheckCircle, Bell } from "@phosphor-icons/react";
import TabBar from "../components/TabBar";
import PageHeader from "../components/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import SectionTitle from "../components/ui/SectionTitle";
import SkeletonCard from "../components/SkeletonCard";
import ReportCenter from "./ReportCenter";
import Personal from "./Personal";
import SupplierScorecard from "./SupplierScorecard";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
  PieChart, Pie,
} from "recharts";

const COLORS = {
  aprobado: "#16A34A",
  enviado: "#2563EB",
  com_menores: "#D97706",
  rechazado: "#DC2626",
  sin_enviar: "#64748B",
};

const RESP_COLORS = ["#4F46E5", "#0D9488", "#D97706", "#DC2626", "#6366F1", "#2563EB"];

export default function ReportsHub({ onTabChange }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("resumen");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const TABS = useMemo(() => [
    { key: "resumen", label: t('tabResumen') },
    { key: "rendimiento", label: t('tabRendimiento') },
    { key: "equipo", label: t('tabEquipo') },
    { key: "centro", label: t('tabReportCenter') },
    { key: "scorecard", label: "Scorecard" },
  ], [t]);

  useEffect(() => {
    const tab = TABS.find(t => t.key === activeTab);
    onTabChange?.(tab?.label || null);
  }, [activeTab, onTabChange, TABS]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/analytics/summary");
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (activeTab === "equipo") {
    return (
      <div>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="reports-tab" />
        <div style={{ marginTop: 20 }}><Personal /></div>
      </div>
    );
  }

  if (activeTab === "centro") {
    return (
      <div>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="reports-tab" />
        <div style={{ marginTop: 20 }}><ReportCenter mode="limited" /></div>
      </div>
    );
  }

  if (activeTab === "scorecard") {
    return (
      <div>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="reports-tab" />
        <div style={{ marginTop: 20 }}><SupplierScorecard /></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="reports-tab" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} height={88} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="reports-tab" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
          <div style={{ textAlign: "center", color: "#DC2626" }}>
            <Warning size={32} style={{ margin: "0 auto 8px" }} />
            <p className="text-text-main" style={{ fontWeight: 700 }}>{t('errorLoadingData')}</p>
            <p className="text-text-muted" style={{ fontSize: 13 }}>{error}</p>
            <button onClick={fetchData} style={{ marginTop: 12, padding: "6px 16px", background: "var(--accent)", color: "#FFF", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>{t('retry')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="reports-tab" />
      <div style={{ marginTop: 20 }}>
        {activeTab === "resumen" && <ResumenTab data={data} fetchData={fetchData} />}
        {activeTab === "rendimiento" && <RendimientoTab data={data} />}
      </div>
    </div>
  );
}

function ResumenTab({ data, fetchData }) {
  const { t } = useI18n();
  const porCliente = (data?.por_cliente || []).slice(0, 10);
  const porTipo = data?.por_tipo_doc || [];
  const heatmap = data?.heatmap_cliente || [];

  // Donut data
  const kpis = data || {};
  const donutData = [
    { name: t('aprobado'), value: kpis.total_aprobados || 0, color: COLORS.aprobado },
    { name: t('enviado'), value: kpis.total_enviados || 0, color: COLORS.enviado },
    { name: t('devolutions'), value: kpis.total_devoluciones || 0, color: COLORS.com_menores },
    { name: t('notSent'), value: kpis.total_sin_enviar || 0, color: COLORS.sin_enviar },
  ].filter(d => d.value > 0);

  const tooltipStyle = {
    contentStyle: { fontSize: 11, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-main)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <motion.button whileTap={{ scale: 0.95 }} onClick={fetchData}
          className="rounded-lg" style={{ padding: "6px 14px", background: "var(--accent)", color: "#FFF", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowClockwise size={14} /> {t('update')}
        </motion.button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <KpiCard label={t('rptAvgApprovalSpeed')} value={`${data?.velocidad_media_dias ?? 0}d`} sub={t('rptAvgDaysWait')} color="var(--accent)" icon={Clock} index={0} />
        <KpiCard label={t('rptApprovalRate')} value={`${data?.clientes_ok ?? 0}/${data?.total_clientes ?? 0}`} sub={t('rptClientsApproved')} color="#16A34A" icon={CheckCircle} index={1} />
        <KpiCard label={t('rptDocsAtRisk')} value={data?.docs_riesgo ?? 0} sub={t('rptNoResponseDays')} color={data?.docs_riesgo > 0 ? "#DC2626" : "#16A34A"} icon={Warning} index={2} />
        <KpiCard label={t('rptExpiring3d')} value={data?.a_vencer_3d ?? 0} sub={t('rptAlmostExpired')} color={data?.a_vencer_3d > 0 ? "#D97706" : "#16A34A"} icon={Bell} index={3} />
      </div>

      {/* Donut + Top 10 clientes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>{t('rptDistByStatus')}</SectionTitle>
          {donutData.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: "0 0 200px" }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                    <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 22, fontWeight: 800, fill: "var(--text-main)" }}>
                      {donutData.reduce((s, d) => s + d.value, 0)}
                    </text>
                    <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fill: "var(--text-muted)" }}>
                      Total
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                {donutData.map(d => {
                  const total = donutData.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? Math.round(d.value / total * 100) : 0;
                  return (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                      <span className="text-text-sub" style={{ fontSize: 13, flex: 1 }}>{d.name}</span>
                      <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{d.value}</span>
                      <span className="text-text-muted" style={{ fontSize: 11, minWidth: 36, textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <p className="text-center py-16 text-sm text-text-muted">{t('noData')}</p>}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>{t('rptTop10Clients')}</SectionTitle>
          {porCliente.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, porCliente.length * 38)}>
              <BarChart data={porCliente} layout="vertical" margin={{ left: 8, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="cliente" width={120} tick={{ fontSize: 11, fill: "var(--text-sub)" }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="media_dias" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {porCliente.map((entry, i) => (
                    <Cell key={i} fill={entry.media_dias > 20 ? "#DC2626" : entry.media_dias > 10 ? "#D97706" : "#16A34A"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center py-16 text-sm text-text-muted">{t('noData')}</p>}
        </div>
      </div>

      {/* Tipo de documento — full width */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>{t('rptDistByDocType')}</SectionTitle>
        {porTipo.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, Math.min(porTipo.length, 12) * 30)}>
            <BarChart data={porTipo.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="tipo" width={120} tick={{ fontSize: 11, fill: "var(--text-sub)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="aprobado" name={t('aprobado')} stackId="a" fill={COLORS.aprobado} maxBarSize={20} />
              <Bar dataKey="enviado" name={t('enviado')} stackId="a" fill={COLORS.enviado} maxBarSize={20} />
              <Bar dataKey="com_menores" name={t('com_menores')} stackId="a" fill={COLORS.com_menores} maxBarSize={20} />
              <Bar dataKey="sin_enviar" name={t('notSent')} stackId="a" fill={COLORS.sin_enviar} radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-center py-16 text-sm text-text-muted">{t('noData')}</p>}
      </div>

      {/* Heatmap + Matrix */}
      {heatmap.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>{t('rptHeatmap')}</SectionTitle>
          <HeatmapInline data={heatmap} />
        </div>
      )}
    </div>
  );
}

function HeatmapInline({ data }) {
  const cols = ["aprobado", "enviado", "com_menores", "rechazado", "sin_enviar"];
  const { t } = useI18n();
  const colLabels = { aprobado: t('aprobado'), enviado: t('enviado'), com_menores: t('com_menores'), rechazado: t('rechazado'), sin_enviar: t('notSent') };
  const colColors = { aprobado: "#16A34A", enviado: "#2563EB", com_menores: "#D97706", rechazado: "#DC2626", sin_enviar: "#64748B" };
  const maxByCol = {};
  cols.forEach(c => { maxByCol[c] = Math.max(1, ...data.map(r => r[c] || 0)); });
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-hover)" }}>
            <th className="text-text-muted" style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>Cliente</th>
            {cols.map(c => <th key={c} style={{ padding: "6px 8px", textAlign: "center", color: colColors[c], fontWeight: 700, borderBottom: "2px solid var(--border)", minWidth: 70 }}>{colLabels[c]}</th>)}
            <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 15).map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="text-text-main" style={{ padding: "5px 10px", fontWeight: 600, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.cliente}</td>
              {cols.map(c => {
                const val = row[c] || 0;
                const intensity = val / maxByCol[c];
                const bg = intensity === 0 ? "var(--bg-page)" : colColors[c] + Math.round(intensity * 255).toString(16).padStart(2, "0");
                return <td key={c} style={{ padding: "5px 8px", textAlign: "center", background: bg, fontWeight: val > 0 ? 700 : 400, color: val > 0 ? "var(--text-main)" : "var(--text-muted)", borderRadius: 4 }}>{val}</td>;
              })}
              <td className="text-text-sub" style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700 }}>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RendimientoTab({ data }) {
  const { t } = useI18n();
  const porResp = data?.por_responsable_doc || [];
  const sorted = [...porResp].sort((a, b) => b.pct - a.pct);
  const matrizData = data?.matriz_comercial_doc || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Leaderboard */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>{t('rptRanking')}</SectionTitle>
        {sorted.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-hover)" }}>
                  {["#", t('thName'), t('total'), t('thApproved'), t('thComplete'), t('thDevol'), t('thRateDevol'), t('thCriticals')].map((h, i) => (
                    <th key={h} className="text-text-muted" style={{ padding: "8px 10px", textAlign: i < 2 ? "left" : "center", fontWeight: 700, borderBottom: "2px solid var(--border)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.responsable} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)" }}>
                    <td className="text-text-muted" style={{ padding: "8px 10px", fontWeight: 700 }}>#{i + 1}</td>
                    <td className="text-text-main" style={{ padding: "8px 10px", fontWeight: 700 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: RESP_COLORS[i % RESP_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: 10, fontWeight: 700 }}>{r.responsable.slice(0, 2).toUpperCase()}</div>
                        {r.responsable}
                      </div>
                    </td>
                    <td className="text-text-sub" style={{ padding: "8px 10px", textAlign: "center" }}>{r.total}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", color: "#16A34A", fontWeight: 700 }}>{r.aprobados}</td>
                    <td style={{ padding: "8px 14px", minWidth: 140 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${r.pct}%`, background: r.pct >= 75 ? "#16A34A" : r.pct >= 50 ? "#D97706" : "#DC2626", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.pct >= 75 ? "#16A34A" : r.pct >= 50 ? "#D97706" : "#DC2626", minWidth: 34, textAlign: "right" }}>{r.pct}%</span>
                      </div>
                    </td>
                    <td className="text-text-sub" style={{ padding: "8px 10px", textAlign: "center" }}>{r.devoluciones}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: (r.tasa_devolucion ?? 0) > 30 ? "#DC2626" : (r.tasa_devolucion ?? 0) > 15 ? "#D97706" : "#16A34A" }}>{r.tasa_devolucion ?? 0}%</td>
                    <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: (r.criticos ?? 0) > 0 ? "#DC2626" : "var(--text-muted)" }}>{r.criticos ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-text-muted" style={{ fontSize: 13 }}>{t('noData')}</p>}
      </div>

      {/* Cards grid */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>{t('rptPerformanceByResp')}</SectionTitle>
        {porResp.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {porResp.map((r, i) => (
              <div key={r.responsable} className="border border-border" style={{ background: "var(--bg-page)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: RESP_COLORS[i % RESP_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: 11, fontWeight: 700 }}>{r.responsable.slice(0, 2).toUpperCase()}</div>
                  <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{r.responsable}</span>
                </div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${r.pct}%`, background: r.pct >= 75 ? "#16A34A" : r.pct >= 50 ? "#D97706" : "#DC2626", borderRadius: 2 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-text-muted">Total</span><span className="text-text-main" style={{ fontWeight: 700 }}>{r.total}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-text-muted">% {t('completed')}</span><span style={{ fontWeight: 700, color: r.pct >= 75 ? "#16A34A" : r.pct >= 50 ? "#D97706" : "#DC2626" }}>{r.pct}%</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-text-muted">{t('devolutions')}</span><span className="text-text-main" style={{ fontWeight: 700 }}>{r.devoluciones}</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-text-muted" style={{ fontSize: 13 }}>{t('noData')}</p>}
      </div>

      {/* Workload stacked bars */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>{t('rptWorkloadByResp')}</SectionTitle>
        {porResp.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {porResp.map(r => {
              const total = r.total || 1;
              const segments = [
                { key: "aprobados", val: r.aprobados, color: "#16A34A" },
                { key: "devoluciones", val: r.devoluciones, color: "#D97706" },
                { key: "sin_enviar", val: r.sin_enviar ?? 0, color: "#64748B" },
              ];
              return (
                <div key={r.responsable} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="text-text-sub" style={{ width: 80, fontSize: 11, fontWeight: 700, textAlign: "right", flexShrink: 0 }}>{r.responsable}</div>
                  <div style={{ flex: 1, display: "flex", height: 16, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                    {segments.map(s => s.val > 0 && <div key={s.key} style={{ flex: s.val / total, background: s.color, minWidth: 2 }} title={`${s.key}: ${s.val}`} />)}
                  </div>
                  <span className="text-text-muted" style={{ fontSize: 11, minWidth: 32, textAlign: "right" }}>{total}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="text-text-muted" style={{ fontSize: 13 }}>{t('noData')}</p>}
      </div>

      {/* Matriz comercial */}
      {matrizData.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>{t('rptMatrixCommercial')}</SectionTitle>
          <MatrizInline data={matrizData} />
        </div>
      )}
    </div>
  );
}

function MatrizInline({ data }) {
  const comerciales = [...new Set(data.map(r => r.comercial))].sort();
  const respDocs = [...new Set(data.map(r => r.resp_doc))].sort();
  const getCell = (com, resp) => data.find(r => r.comercial === com && r.resp_doc === resp);
  const pctColor = (pct) => pct >= 75 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "var(--bg-hover)" }}>
            <th className="text-text-muted" style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, borderBottom: "2px solid var(--border)" }}>Comercial / Doc.</th>
            {respDocs.map(rd => <th key={rd} className="text-text-sub" style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, borderBottom: "2px solid var(--border)", minWidth: 64 }}>{rd}</th>)}
          </tr>
        </thead>
        <tbody>
          {comerciales.map((com, i) => (
            <tr key={com} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)" }}>
              <td className="text-text-main" style={{ padding: "5px 10px", fontWeight: 700 }}>{com}</td>
              {respDocs.map(rd => {
                const cell = getCell(com, rd);
                return (
                  <td key={rd} style={{ padding: "5px 8px", textAlign: "center" }}>
                    {cell ? (
                      <span style={{ display: "inline-block", minWidth: 40, padding: "2px 6px", borderRadius: 6, background: pctColor(cell.pct) + "22", color: pctColor(cell.pct), fontWeight: 700, fontSize: 11 }}>{cell.pct}%</span>
                    ) : <span style={{ color: "var(--border)" }}>—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
