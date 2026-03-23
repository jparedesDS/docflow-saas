import React, { useState, useEffect, useMemo } from "react";
import {
  ChartBar,
  Trophy,
  Warning,
  MagnifyingGlass,
  UsersThree,
} from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";

function ScoreBar({ score }) {
  let color = "#DC2626";
  if (score >= 80) color = "#16A34A";
  else if (score >= 50) color = "#D97706";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--bg-hover)",
          borderRadius: 3,
          overflow: "hidden",
          maxWidth: 80,
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, score))}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, minWidth: 28 }}>
        {score}
      </span>
    </div>
  );
}

function TinySparkline({ trend }) {
  if (!trend || !trend.length) return null;

  const chartData = trend.map((v, i) => ({ v, i }));

  return (
    <div style={{ width: 60, height: 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="v" fill="var(--accent)" radius={[1, 1, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 180,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}14`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} weight="duotone" color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function SupplierScorecard() {
  const { t } = useI18n();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get("/analytics/scorecard")
      .then((res) => setData(res.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      (row.client || row.Cliente || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const avgScore = useMemo(() => {
    if (!data.length) return 0;
    const sum = data.reduce((acc, r) => acc + (r.score || 0), 0);
    return Math.round(sum / data.length);
  }, [data]);

  const bestPerformer = useMemo(() => {
    if (!data.length) return "—";
    const best = data.reduce((a, b) => ((a.score || 0) >= (b.score || 0) ? a : b), data[0]);
    return best.client || best.Cliente || "—";
  }, [data]);

  const worstPerformer = useMemo(() => {
    if (!data.length) return "—";
    const worst = data.reduce((a, b) => ((a.score || 0) <= (b.score || 0) ? a : b), data[0]);
    return worst.client || worst.Cliente || "—";
  }, [data]);

  if (loading) {
    return (
      <div
        style={{
          padding: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        {t("loading") || "Cargando..."}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div
        style={{
          padding: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: "var(--text-muted)",
        }}
      >
        <UsersThree size={40} weight="thin" />
        <span style={{ fontSize: 13 }}>
          {t("noSupplierData") || "Sin datos de proveedores"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-main)",
          marginBottom: 20,
        }}
      >
        {t("supplierScorecard") || "Scorecard de Proveedores"}
      </h2>

      {/* KPI cards */}
      <div
        style={{
          display: "flex",
          gap: 14,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <KpiCard
          icon={ChartBar}
          label={t("avgScore") || "Puntuaci\u00f3n Media"}
          value={avgScore}
          color="#4F46E5"
        />
        <KpiCard
          icon={Trophy}
          label={t("bestPerformer") || "Mejor Proveedor"}
          value={bestPerformer}
          color="#16A34A"
        />
        <KpiCard
          icon={Warning}
          label={t("worstPerformer") || "Peor Proveedor"}
          value={worstPerformer}
          color="#DC2626"
        />
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          padding: "6px 12px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          maxWidth: 320,
        }}
      >
        <MagnifyingGlass size={14} color="var(--text-muted)" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchClient") || "Buscar cliente..."}
          style={{
            flex: 1,
            fontSize: 12,
            background: "transparent",
            border: "none",
            color: "var(--text-main)",
            outline: "none",
          }}
        />
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-input)",
              }}
            >
              {[
                t("colClient") || "Cliente",
                t("colScore") || "Score",
                t("colApprovalRate") || "Tasa Aprobaci\u00f3n",
                t("colAvgResponseDays") || "Avg D\u00edas Respuesta",
                t("colCriticalDocs") || "Docs Cr\u00edticos",
                t("colTotalDocs") || "Total Docs",
                t("colTrend") || "Tendencia",
              ].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr
                key={row.client || row.Cliente || idx}
                style={{
                  borderBottom:
                    idx < filtered.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <td
                  style={{
                    padding: "10px 14px",
                    fontWeight: 500,
                    color: "var(--text-main)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.client || row.Cliente || "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <ScoreBar score={row.score || 0} />
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "var(--text-main)",
                  }}
                >
                  {row.approval_rate != null
                    ? `${row.approval_rate.toFixed(1)}%`
                    : "—"}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "var(--text-main)",
                  }}
                >
                  {row.avg_response_days != null
                    ? row.avg_response_days.toFixed(1)
                    : "—"}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color:
                      (row.critical_docs || 0) > 0
                        ? "#DC2626"
                        : "var(--text-main)",
                    fontWeight: (row.critical_docs || 0) > 0 ? 600 : 400,
                  }}
                >
                  {row.critical_docs ?? "—"}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    color: "var(--text-main)",
                  }}
                >
                  {row.total_docs ?? "—"}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <TinySparkline trend={row.trend} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 12,
                  }}
                >
                  {t("noResults") || "Sin resultados"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
