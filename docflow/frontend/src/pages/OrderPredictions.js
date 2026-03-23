import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  TrendUp,
  CheckCircle,
  Clock,
  Warning,
  ArrowClockwise,
  SortAscending,
  SortDescending,
  ChartScatter,
} from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import SkeletonCard from "../components/SkeletonCard";
import KpiCard from "../components/ui/KpiCard";
import SectionTitle from "../components/ui/SectionTitle";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CONFIDENCE_COLORS = {
  high: "#16A34A",
  medium: "#D97706",
  low: "#DC2626",
};

const CONFIDENCE_BG = {
  high: "#16A34A18",
  medium: "#D9770618",
  low: "#DC262618",
};

export default function OrderPredictions() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("days_remaining");
  const [sortDir, setSortDir] = useState("asc");
  const [expandedOrder, setExpandedOrder] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/predictions/order-predictions");
      setPredictions(res.data || []);
    } catch (e) {
      showToast(t("errorLoadingData") || "Error loading data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sorted = useMemo(() => {
    const arr = [...predictions];
    arr.sort((a, b) => {
      let va = a[sortBy] ?? 999;
      let vb = b[sortBy] ?? 999;
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [predictions, sortBy, sortDir]);

  const stats = useMemo(() => {
    const active = predictions.filter((p) => p.status === "in_progress");
    const completed = predictions.filter((p) => p.status === "completed");
    const avgDays =
      active.length > 0
        ? Math.round(
            active.reduce((s, p) => s + (p.days_remaining || 0), 0) /
              active.length
          )
        : 0;
    const highConf = active.filter((p) => p.confidence === "high").length;
    return {
      total: predictions.length,
      active: active.length,
      completed: completed.length,
      avgDays,
      highConf,
    };
  }, [predictions]);

  const scatterData = useMemo(() => {
    return predictions
      .filter((p) => p.status === "in_progress")
      .map((p) => ({
        x: p.pct_complete,
        y: p.days_remaining,
        pedido: p.pedido,
        confidence: p.confidence,
      }));
  }, [predictions]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const SortIcon = sortDir === "asc" ? SortAscending : SortDescending;

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          marginTop: 20,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} height={88} />
          ))}
        </div>
        <SkeletonCard height={300} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <TrendUp
            size={20}
            weight="bold"
            style={{ color: "var(--accent)" }}
          />
          <span
            className="text-text-main"
            style={{ fontSize: 16, fontWeight: 700 }}
          >
            {t("orderPredictions") || "Prediccion de pedidos"}
          </span>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={fetchData}
          className="rounded-lg"
          style={{
            padding: "6px 14px",
            background: "var(--accent)",
            color: "#FFF",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowClockwise size={14} />{" "}
          {t("update") || "Actualizar"}
        </motion.button>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <KpiCard
          label={t("total") || "Total"}
          value={stats.total}
          sub={t("analyticsOrders") || "Pedidos"}
          color="var(--accent)"
          icon={ChartScatter}
          index={0}
        />
        <KpiCard
          label={t("completed") || "Completados"}
          value={stats.completed}
          sub={`${stats.active} ${t("pending") || "activos"}`}
          color="#16A34A"
          icon={CheckCircle}
          index={1}
        />
        <KpiCard
          label={t("daysRemaining") || "Dias restantes"}
          value={`${stats.avgDays}d`}
          sub={t("rptAvgDaysWait") || "promedio"}
          color="#D97706"
          icon={Clock}
          index={2}
        />
        <KpiCard
          label={t("highConfidence") || "Alta confianza"}
          value={stats.highConf}
          sub={t("orderPredictions") || "predicciones"}
          color="#16A34A"
          icon={TrendUp}
          index={3}
        />
      </div>

      {/* Scatter chart */}
      {scatterData.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <SectionTitle>
            {t("daysRemaining") || "Dias restantes"} vs %{" "}
            {t("completed") || "Completado"}
          </SectionTitle>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                type="number"
                dataKey="x"
                name="%"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                label={{
                  value: `% ${t("completed") || "Completado"}`,
                  position: "bottom",
                  fontSize: 11,
                  fill: "var(--text-muted)",
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={t("days") || "Dias"}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                label={{
                  value: t("daysRemaining") || "Dias",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 11,
                  fill: "var(--text-muted)",
                }}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                }}
                formatter={(val, name) => [val, name === "x" ? "%" : t("days") || "Dias"]}
                labelFormatter={() => ""}
              />
              <Scatter data={scatterData} fill="var(--accent)">
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={CONFIDENCE_COLORS[entry.confidence] || "#6366F1"}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            {["high", "medium", "low"].map((c) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: CONFIDENCE_COLORS[c],
                  }}
                />
                <span className="text-text-muted">
                  {t(`${c}Confidence`) || c}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="card" style={{ padding: 20 }}>
        <SectionTitle>
          {t("orderPredictions") || "Prediccion de pedidos"}
        </SectionTitle>
        {sorted.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ background: "var(--bg-hover)" }}>
                  {[
                    {
                      key: "pedido",
                      label: t("analyticsOrders") || "Pedido",
                    },
                    { key: "cliente", label: t("client") || "Cliente" },
                    {
                      key: "pct_complete",
                      label: `% ${t("completed") || "Completado"}`,
                    },
                    {
                      key: "days_remaining",
                      label: t("daysRemaining") || "Dias rest.",
                    },
                    {
                      key: "predicted_date",
                      label: t("predictedDate") || "Fecha est.",
                    },
                    {
                      key: "confidence",
                      label: t("confidence") || "Confianza",
                    },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="text-text-muted"
                      style={{
                        padding: "8px 10px",
                        textAlign:
                          col.key === "pedido" || col.key === "cliente"
                            ? "left"
                            : "center",
                        fontWeight: 700,
                        borderBottom: "2px solid var(--border)",
                        fontSize: 11,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {col.label}
                        {sortBy === col.key && <SortIcon size={12} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => {
                  const isCompleted = p.status === "completed";
                  const conf = p.confidence || "medium";
                  const isExpanded = expandedOrder === p.pedido;
                  return (
                    <React.Fragment key={p.pedido}>
                      <motion.tr
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() =>
                          setExpandedOrder(isExpanded ? null : p.pedido)
                        }
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background:
                            i % 2 === 0 ? "var(--bg-card)" : "var(--bg-page)",
                          cursor: "pointer",
                        }}
                      >
                        <td
                          className="text-text-main"
                          style={{
                            padding: "8px 10px",
                            fontWeight: 700,
                          }}
                        >
                          {p.pedido}
                        </td>
                        <td
                          className="text-text-sub"
                          style={{
                            padding: "8px 10px",
                            maxWidth: 140,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.cliente}
                        </td>
                        <td style={{ padding: "8px 14px", minWidth: 140 }}>
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
                                background: "var(--border)",
                                borderRadius: 3,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${p.pct_complete}%`,
                                  background: isCompleted
                                    ? "#16A34A"
                                    : p.pct_complete >= 75
                                    ? "#16A34A"
                                    : p.pct_complete >= 50
                                    ? "#D97706"
                                    : "#DC2626",
                                  borderRadius: 3,
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: isCompleted
                                  ? "#16A34A"
                                  : p.pct_complete >= 75
                                  ? "#16A34A"
                                  : p.pct_complete >= 50
                                  ? "#D97706"
                                  : "#DC2626",
                                minWidth: 34,
                                textAlign: "right",
                              }}
                            >
                              {p.pct_complete}%
                            </span>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "center",
                            fontWeight: 700,
                            color: isCompleted
                              ? "#16A34A"
                              : p.days_remaining > 30
                              ? "#DC2626"
                              : p.days_remaining > 15
                              ? "#D97706"
                              : "var(--text-main)",
                          }}
                        >
                          {isCompleted ? (
                            <CheckCircle
                              size={16}
                              weight="fill"
                              color="#16A34A"
                            />
                          ) : (
                            `${p.days_remaining}d`
                          )}
                        </td>
                        <td
                          className="text-text-sub"
                          style={{
                            padding: "8px 10px",
                            textAlign: "center",
                            fontSize: 12,
                          }}
                        >
                          {p.predicted_date || "—"}
                        </td>
                        <td
                          style={{
                            padding: "8px 10px",
                            textAlign: "center",
                          }}
                        >
                          {isCompleted ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "#16A34A18",
                                color: "#16A34A",
                                fontWeight: 700,
                                fontSize: 11,
                              }}
                            >
                              {t("completed") || "Completado"}
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: CONFIDENCE_BG[conf],
                                color: CONFIDENCE_COLORS[conf],
                                fontWeight: 700,
                                fontSize: 11,
                              }}
                            >
                              {t(`${conf}Confidence`) || conf}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                      {/* Expanded details */}
                      {isExpanded && p.factors && (
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              padding: 0,
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              style={{
                                padding: "12px 20px",
                                background: "var(--bg-page)",
                              }}
                            >
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(140px, 1fr))",
                                  gap: 12,
                                }}
                              >
                                <FactorCard
                                  label={
                                    t("daysRemaining") || "Base (dias)"
                                  }
                                  value={`${p.factors.base_days}d`}
                                  sub={`${t("client") || "Cliente"}: ${p.client_avg_days}d avg`}
                                />
                                <FactorCard
                                  label="Factor critico"
                                  value={`x${p.factors.critical_factor}`}
                                  sub={`${p.criticos_pending || 0} ${t("pending") || "pendientes"}`}
                                />
                                <FactorCard
                                  label="Factor revision"
                                  value={`x${p.factors.revision_factor}`}
                                  sub={t("revisionUpdated") || "Revision"}
                                />
                                <FactorCard
                                  label="Factor sin enviar"
                                  value={`x${p.factors.unsent_factor}`}
                                  sub={`${p.sin_enviar || 0} ${t("notSent") || "sin enviar"}`}
                                />
                                <FactorCard
                                  label={t("total") || "Total docs"}
                                  value={p.total}
                                  sub={`${p.aprobados} ${t("approved") || "aprobados"}`}
                                />
                                <FactorCard
                                  label={t("pending") || "Pendientes"}
                                  value={p.pending}
                                  sub={`${p.sin_enviar || 0} ${t("notSent") || "sin enviar"}`}
                                />
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-text-muted" style={{ fontSize: 13 }}>
            {t("noData") || "Sin datos"}
          </p>
        )}
      </div>
    </div>
  );
}

function FactorCard({ label, value, sub }) {
  return (
    <div
      className="border border-border"
      style={{
        background: "var(--bg-card)",
        borderRadius: 8,
        padding: "10px 14px",
      }}
    >
      <div
        className="text-text-muted"
        style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}
      >
        {label}
      </div>
      <div
        className="text-text-main"
        style={{ fontSize: 18, fontWeight: 800 }}
      >
        {value}
      </div>
      <div
        className="text-text-muted"
        style={{ fontSize: 10, marginTop: 2 }}
      >
        {sub}
      </div>
    </div>
  );
}
