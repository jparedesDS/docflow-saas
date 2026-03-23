import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ReferenceLine,
} from "recharts";
import { ChartLine } from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";

function mergeData(baseline, actual, predicted) {
  const map = {};

  (baseline || []).forEach((d) => {
    if (!map[d.month]) map[d.month] = { month: d.month };
    map[d.month].baseline = d.value;
  });
  (actual || []).forEach((d) => {
    if (!map[d.month]) map[d.month] = { month: d.month };
    map[d.month].actual = d.value;
  });
  (predicted || []).forEach((d) => {
    if (!map[d.month]) map[d.month] = { month: d.month };
    map[d.month].predicted = d.value;
  });

  // Calculate risk zone: when actual < baseline
  return Object.values(map)
    .sort((a, b) => {
      if (a.month < b.month) return -1;
      if (a.month > b.month) return 1;
      return 0;
    })
    .map((d) => ({
      ...d,
      riskZone:
        d.actual != null && d.baseline != null && d.actual < d.baseline
          ? d.baseline - d.actual
          : 0,
      riskBase: d.actual != null && d.baseline != null && d.actual < d.baseline
          ? d.actual
          : null,
    }));
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "var(--shadow-md)",
        fontSize: 11,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          color: "var(--text-main)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {payload.map((entry, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-sub, var(--text-main))",
            fontSize: 11,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: entry.color,
              flexShrink: 0,
            }}
          />
          <span>{entry.name}: </span>
          <span style={{ fontWeight: 600 }}>
            {entry.value != null ? entry.value.toFixed(1) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function SCurveChart({ data: dataProp }) {
  const { t } = useI18n();
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(!dataProp);

  useEffect(() => {
    if (dataProp) {
      setChartData(dataProp);
      setLoading(false);
      return;
    }
    // Fetch from API if no data prop
    api
      .get("/analytics/s-curve")
      .then((res) => setChartData(res.data))
      .catch(() => setChartData(null))
      .finally(() => setLoading(false));
  }, [dataProp]);

  if (loading) {
    return (
      <div
        style={{
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        {t("loading") || "Cargando..."}
      </div>
    );
  }

  if (!chartData || (!chartData.baseline?.length && !chartData.actual?.length && !chartData.predicted?.length)) {
    return (
      <div
        style={{
          height: 300,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: "var(--text-muted)",
        }}
      >
        <ChartLine size={32} weight="thin" />
        <span style={{ fontSize: 12 }}>
          {t("noSCurveData") || "Sin datos de curva S"}
        </span>
      </div>
    );
  }

  const merged = mergeData(chartData.baseline, chartData.actual, chartData.predicted);

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={merged}
          margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="plainline"
          />

          {/* Risk zone area: gap between baseline and actual when actual < baseline */}
          <Area
            dataKey="riskZone"
            stackId="risk"
            fill="rgba(220, 38, 38, 0.08)"
            stroke="none"
            baseLine={0}
            name={t("scurveRiskZone") || "Zona de riesgo"}
            legendType="none"
          />

          {/* Baseline line */}
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="#94A3B8"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            dot={false}
            name={t("scurveBaseline") || "Planificado"}
            activeDot={{ r: 3, stroke: "#94A3B8", fill: "var(--bg-card)" }}
          />

          {/* Actual line */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#4F46E5"
            strokeWidth={2}
            dot={false}
            name={t("scurveActual") || "Real"}
            activeDot={{ r: 4, stroke: "#4F46E5", fill: "var(--bg-card)" }}
          />

          {/* Predicted line */}
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#D97706"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            name={t("scurvePredicted") || "Previsto"}
            activeDot={{ r: 3, stroke: "#D97706", fill: "var(--bg-card)" }}
          />

          <ReferenceLine y={0} stroke="var(--border)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
