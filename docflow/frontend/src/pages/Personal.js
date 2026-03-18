import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowsClockwise, CaretDown, CaretUp, Warning } from "@phosphor-icons/react";
import api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import { useI18n } from "../contexts/I18nContext";

// Colores de avatar por hash de iniciales
const AVATAR_COLORS = [
  "#3B82F6", "#16A34A", "#D97706", "#DB2777",
  "#DC2626", "#A855F7", "#14B8A6", "#CA8A04",
];

function avatarColor(iniciales) {
  let hash = 0;
  for (let i = 0; i < iniciales.length; i++) hash = iniciales.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function PriorityBadge({ prioridad }) {
  const colors = { alta: "#DC2626", media: "#D97706", baja: "#71717A" };
  const color = colors[prioridad] || "#71717A";
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
      background: color + "22", color, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {prioridad}
    </span>
  );
}

function UrgencyDot({ dias }) {
  const color = dias > 30 ? "#DC2626" : dias > 15 ? "#D97706" : "#16A34A";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 32, padding: "1px 5px", borderRadius: 4,
      background: color + "22", color, fontSize: 10, fontWeight: 700,
    }}>
      {dias}d
    </span>
  );
}

function KpiPill({ label, value, color }) {
  return (
    <div className="rounded-lg border border-border" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "6px 10px",
      background: "var(--bg-page)",
      minWidth: 56,
    }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: color || "var(--text-main)", lineHeight: 1 }}>{value}</span>
      <span className="text-text-muted" style={{ fontSize: 9, marginTop: 2, textAlign: "center" }}>{label}</span>
    </div>
  );
}

function ProgressBar({ pct }) {
  const color = pct >= 75 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
  return (
    <div style={{ flex: 1, height: 5, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
    </div>
  );
}

function WorkerCard({ worker, onSyncOne }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const color = avatarColor(worker.iniciales);
  const { kpis, tareas_pendientes, urgencias } = worker;
  const nTareas = tareas_pendientes.length;
  const nUrgencias = urgencias.length;

  return (
    <motion.div
      layout
      className="card"
      style={{
        overflow: "hidden",
        cursor: "pointer",
      }}
      whileHover={{ borderColor: color + "60" }}
      transition={{ duration: 0.15 }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
          background: color, display: "flex", alignItems: "center",
          justifyContent: "center", color: "#FFF", fontSize: 13, fontWeight: 800,
        }}>
          {worker.iniciales}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="text-text-main" style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {worker.nombre}
          </p>
          <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            {nTareas > 0 && (
              <span style={{ fontSize: 10, background: "#3B82F620", color: "#3B82F6", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
                {nTareas} tarea{nTareas !== 1 ? "s" : ""}
              </span>
            )}
            {nUrgencias > 0 && (
              <span style={{ fontSize: 10, background: "#DC262620", color: "#DC2626", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>
                {nUrgencias} urgencia{nUrgencias !== 1 ? "s" : ""}
              </span>
            )}
            {nTareas === 0 && nUrgencias === 0 && (
              <span className="text-text-muted" style={{ fontSize: 10 }}>Sin pendientes</span>
            )}
          </div>
        </div>
        <span className="text-text-muted" style={{ flexShrink: 0 }}>
          {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </span>
      </div>

      {/* KPI row — siempre visible */}
      <div style={{ padding: "0 16px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <KpiPill label={t('total')} value={kpis.total} />
        <KpiPill label={t('aprobado')} value={`${kpis.pct}%`} color={kpis.pct >= 75 ? "#16A34A" : kpis.pct >= 50 ? "#D97706" : "#DC2626"} />
        {kpis.criticos > 0 && <KpiPill label={t('docsCritical')} value={kpis.criticos} color="#DC2626" />}
        {kpis.devoluciones > 0 && <KpiPill label={t('devolutions')} value={kpis.devoluciones} color="#D97706" />}
        {kpis.vel_media > 0 && <KpiPill label={t('persApprovalSpeed')} value={`${kpis.vel_media}d`} />}
        {kpis.sin_enviar > 0 && <KpiPill label={t('notSent')} value={kpis.sin_enviar} color={kpis.sin_enviar > 5 ? "#DC2626" : "#D97706"} />}
      </div>

      {/* Barra de progreso */}
      {kpis.total > 0 && (
        <div style={{ padding: "0 16px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <ProgressBar pct={kpis.pct} />
          <span className="text-text-muted" style={{ fontSize: 10, whiteSpace: "nowrap" }}>{kpis.pct}% ✓</span>
        </div>
      )}

      {/* Contenido expandido */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Rendimiento */}
              {(kpis.tasa_devolucion > 0 || kpis.dias_envio_media > 0 || kpis.revision_media > 0) && (
                <div>
                  <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Rendimiento
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {kpis.tasa_devolucion > 0 && (
                      <span style={{ fontSize: 11, color: kpis.tasa_devolucion > 20 ? "#DC2626" : "var(--text-sub)" }}>
                        <strong>{kpis.tasa_devolucion}%</strong> <span className="text-text-muted">devoluc.</span>
                      </span>
                    )}
                    {kpis.dias_envio_media > 0 && (
                      <span className="text-text-sub" style={{ fontSize: 11 }}>
                        <strong>{kpis.dias_envio_media}d</strong> <span className="text-text-muted">envío medio</span>
                      </span>
                    )}
                    {kpis.revision_media > 0 && (
                      <span style={{ fontSize: 11, color: kpis.revision_media > 1.5 ? "#D97706" : "var(--text-sub)" }}>
                        <strong>r{kpis.revision_media}</strong> <span className="text-text-muted">rev. media</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Tareas */}
              <div>
                <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Tareas pendientes
                </p>
                {tareas_pendientes.length === 0 ? (
                  <p className="text-text-muted" style={{ fontSize: 11, fontStyle: "italic" }}>Sin tareas pendientes</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {tareas_pendientes.slice(0, 5).map(t => {
                      const fechaCorta = t.fecha_limite
                        ? new Date(t.fecha_limite).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
                        : null;
                      return (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <PriorityBadge prioridad={t.prioridad} />
                          <span className="text-text-sub" style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.titulo}
                          </span>
                          {fechaCorta && (
                            <span className="text-text-muted" style={{ fontSize: 10, whiteSpace: "nowrap", flexShrink: 0 }}>{fechaCorta}</span>
                          )}
                        </div>
                      );
                    })}
                    {tareas_pendientes.length > 5 && (
                      <p className="text-text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                        +{tareas_pendientes.length - 5} más
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Urgencias */}
              {urgencias.length > 0 && (
                <div>
                  <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    Documentos urgentes asignados
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {urgencias.slice(0, 5).map((u, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <UrgencyDot dias={u.dias} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#3B82F6", whiteSpace: "nowrap" }}>{u.doc_eipsa}</span>
                          {u.cliente && (
                            <span style={{ fontSize: 9, background: "#3B82F615", color: "#3B82F6", borderRadius: 3, padding: "1px 5px", whiteSpace: "nowrap", flexShrink: 0 }}>
                              {u.cliente}
                            </span>
                          )}
                          {u.critico && <Warning size={12} color="#DC2626" weight="fill" style={{ flexShrink: 0 }} />}
                        </div>
                        <div style={{ paddingLeft: 40, display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="text-text-sub" style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {u.titulo}
                          </span>
                          {u.estado && (
                            <span className="text-text-muted" style={{ fontSize: 9, whiteSpace: "nowrap", flexShrink: 0 }}>{u.estado}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {urgencias.length > 5 && (
                      <p className="text-text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                        +{urgencias.length - 5} más
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="card" style={{
      padding: 16, display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--border)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, background: "var(--border)", borderRadius: 4, marginBottom: 6, width: "70%" }} />
          <div style={{ height: 10, background: "var(--border)", borderRadius: 4, width: "40%" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[56, 56, 56].map((w, i) => (
          <div key={i} className="rounded-lg" style={{ width: w, height: 44, background: "var(--border)" }} />
        ))}
      </div>
      <div style={{ height: 5, background: "var(--border)", borderRadius: 4 }} />
    </div>
  );
}

export default function Personal() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/personal/overview");
      setWorkers(res.data.workers || []);
      setLastUpdated(new Date());
    } catch (e) {
      setError("No se pudo cargar el resumen del equipo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await api.post("/personal/sync-all");
      await fetchOverview();
      showToast("Tareas sincronizadas", "success");
    } catch {
      showToast("Error al sincronizar tareas", "error");
    }
    setSyncing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 className="text-text-main" style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t('persTitle')}</h1>
          <p className="text-text-muted" style={{ fontSize: 11, marginTop: 2 }}>
            {t('persDesc')}
            {lastUpdated && (
              <span> · Actualizado {lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="rounded-lg border border-border text-text-sub"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "transparent",
            }}
          >
            <ArrowsClockwise size={14} className={loading ? "animate-spin" : ""} />
            Refrescar
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="rounded-lg"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "var(--accent)", border: "none", color: "#FFF",
              opacity: syncing ? 0.7 : 1,
            }}
          >
            <ArrowsClockwise size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando…" : "Sync tareas Excel"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg" style={{ padding: "10px 16px", background: "#DC262620", color: "#DC2626", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {loading
          ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
          : workers.map(w => (
              <WorkerCard key={w.iniciales} worker={w} />
            ))
        }
      </div>
    </div>
  );
}
