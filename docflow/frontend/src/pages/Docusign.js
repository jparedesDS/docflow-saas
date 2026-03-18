import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Signature,
  CheckCircle,
  XCircle,
  Clock,
  Warning,
  ArrowClockwise,
  X,
  User,
  DownloadSimple,
  IdentificationCard,
  Users,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import PageHeader from "../components/PageHeader";
import KpiCard from "../components/ui/KpiCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import SectionBlock from "../components/ui/SectionBlock";
import FieldCard from "../components/ui/FieldCard";
import api from "../services/api";
import { formatDate } from "../utils/dates";
import { DOCUSIGN_STATUS_COLORS as STATUS_COLORS } from "../constants/status";

function RecipientAvatar({ r }) {
  const signed = r.status === "completed";
  const declined = r.status === "declined";
  const initials = r.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div title={`${r.name} — ${r.status}`} style={{ position: "relative", display: "inline-block" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: signed ? "#16A34A20" : declined ? "#DC262620" : "#3B82F620",
        border: `2px solid ${signed ? "#16A34A" : declined ? "#DC2626" : "#3B82F6"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700,
        color: signed ? "#16A34A" : declined ? "#DC2626" : "#2563EB",
      }}>
        {initials || <User size={12} />}
      </div>
      <div style={{
        position: "absolute", bottom: -2, right: -2,
        width: 10, height: 10, borderRadius: "50%",
        background: signed ? "#16A34A" : declined ? "#DC2626" : "#94A3B8",
        border: "1.5px solid var(--bg-card)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {signed && <CheckCircle size={7} color="#fff" weight="fill" />}
        {declined && <XCircle size={7} color="#fff" weight="fill" />}
      </div>
    </div>
  );
}

// ── Panel lateral de detalle ──────────────────────────────────────────────────
function DetailPanel({ envelopeId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!envelopeId) return;
    setLoading(true);
    api.get(`/docusign/envelopes/${envelopeId}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [envelopeId]);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 35 }}
      className="bg-card"
      style={{
        position: "fixed", top: 64, right: 0, bottom: 0, width: 400,
        borderLeft: "1px solid var(--border)",
        zIndex: 40, display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px #00000030",
      }}
    >
      {/* Header */}
      <div
        className="border-b border-border"
        style={{ padding: "16px 20px", borderLeft: "4px solid #3B82F6" }}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>
              {data?.subject || "Detalle del sobre"}
            </h3>
            {data && (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
                <Badge status={data.status} variant="pill" colorMap={STATUS_COLORS} />
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" style={{ marginLeft: 8 }}>
            <X size={16} weight="bold" className="text-text-muted" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 20px 16px" }}>
        {loading && (
          <div className="text-text-muted" style={{ textAlign: "center", paddingTop: 40 }}>
            Cargando...
          </div>
        )}
        {!loading && !data && (
          <div className="text-text-muted" style={{ textAlign: "center", paddingTop: 40 }}>
            No se pudo cargar el sobre.
          </div>
        )}
        {!loading && data && (
          <>
            {/* Información */}
            <SectionBlock icon={IdentificationCard} title="Información">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <FieldCard label="Remitente" value={data.sender_name || data.sender || "—"} />
                <FieldCard label="Enviado" value={data.sent_at ? formatDate(data.sent_at) : "—"} />
                <FieldCard label="Completado" value={data.completed_at ? formatDate(data.completed_at) : "—"} />
                <FieldCard label="Expira" value={data.expires_at ? formatDate(data.expires_at) : "—"} />
              </div>
            </SectionBlock>

            {/* Firmantes */}
            {data.recipients?.length > 0 && (
              <SectionBlock icon={Users} title="Firmantes">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.recipients.map((r, i) => (
                    <div key={i} className="rounded-md" style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", background: "var(--bg-page)",
                    }}>
                      <RecipientAvatar r={r} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</p>
                        <p className="text-text-muted" style={{ fontSize: 10 }}>{r.email}</p>
                      </div>
                      <Badge status={r.status} variant="pill" colorMap={STATUS_COLORS} />
                    </div>
                  ))}
                </div>
              </SectionBlock>
            )}

            {/* Historial */}
            {data.history?.length > 0 && (
              <SectionBlock icon={ClockCounterClockwise} title="Historial de eventos">
                <div className="relative" style={{ paddingLeft: 14 }}>
                  {data.history.length > 1 && (
                    <div style={{
                      position: "absolute", left: 3, top: 4, bottom: 4, width: 2,
                      background: "var(--border)", borderRadius: 1,
                    }} />
                  )}
                  {data.history.map((h, i) => (
                    <div key={i} className="relative flex items-center gap-3" style={{ paddingBottom: i < data.history.length - 1 ? 14 : 0 }}>
                      <div style={{
                        position: "absolute", left: -14, top: "50%", transform: "translateY(-50%)",
                        width: 8, height: 8, borderRadius: "50%",
                        backgroundColor: "#3B82F6",
                        boxShadow: "0 0 0 3px #3B82F625",
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="text-text-main" style={{ fontSize: 11, fontWeight: 600 }}>{h.event || "Evento"}</p>
                        {h.user && <p className="text-text-muted" style={{ fontSize: 10 }}>{h.user}</p>}
                      </div>
                      {h.date && (
                        <span className="text-text-muted font-mono" style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                          {formatDate(h.date)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </SectionBlock>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Docusign() {
  const [envelopes, setEnvelopes] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [apiStatus, setApiStatus] = useState(null); // "ok" | "error" | null
  const [downloading, setDownloading] = useState({});

  async function handleDownload(envId) {
    setDownloading(d => ({ ...d, [envId]: true }));
    try {
      const res = await api.get(`/docusign/envelopes/${envId}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sobre_${envId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("No se pudo descargar el PDF.");
    } finally {
      setDownloading(d => ({ ...d, [envId]: false }));
    }
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const effectiveDays = days === 0 ? 3650 : days;
      const [envRes, kpiRes] = await Promise.all([
        api.get("/docusign/envelopes", { params: { days: effectiveDays, ...(filterStatus ? { status: filterStatus } : {}) } }),
        api.get("/docusign/kpis", { params: { days: effectiveDays } }),
      ]);
      setConfigured(true);
      setApiStatus("ok");
      setEnvelopes(Array.isArray(envRes.data) ? envRes.data : []);
      setKpis(kpiRes.data);
      setLastSync(new Date());
    } catch (err) {
      if (err.response?.status === 503) {
        setConfigured(false);
      }
      setApiStatus("error");
    } finally {
      setLoading(false);
    }
  }, [days, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = envelopes.filter(e => {
    if (!filterSearch) return true;
    const q = filterSearch.toLowerCase();
    return (
      e.subject?.toLowerCase().includes(q) ||
      e.sender_name?.toLowerCase().includes(q) ||
      e.sender?.toLowerCase().includes(q)
    );
  });

  const kpiCards = [
    {
      label: "Pendientes", value: kpis?.by_status?.sent ?? "—",
      icon: Clock, color: "#CA8A04",
    },
    {
      label: "Completados", value: kpis?.by_status?.completed ?? "—",
      icon: CheckCircle, color: "#16A34A",
    },
    {
      label: "Rechazados", value: kpis?.by_status?.declined ?? "—",
      icon: XCircle, color: "#DC2626",
    },
    {
      label: "Expirados", value: kpis?.by_status?.timed_out ?? "—",
      icon: Warning, color: "#D97706",
    },
    {
      label: "Total", value: kpis?.total ?? "—",
      icon: Signature, color: "#3B82F6",
    },
  ];

  // ── No configurado ─────────────────────────────────────────────────────────
  if (!loading && !configured) {
    return (
      <div>
        <PageHeader
          title="Contratos & Firmas"
          subtitle="DocuSign eSignature"
          icon={Signature}
          color="#3B82F6"
        />
        <div className="bg-card border border-border" style={{
          marginTop: 40, padding: 32, borderRadius: 16,
          textAlign: "center",
        }}>
          <Signature size={40} color="#3B82F6" style={{ margin: "0 auto 16px" }} />
          <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            DocuSign no configurado
          </h3>
          <p className="text-text-muted" style={{ fontSize: 13, maxWidth: 420, margin: "0 auto 20px" }}>
            Para activar la integración añade las siguientes variables al archivo <code style={{ background: "var(--bg-hover)", padding: "1px 4px", borderRadius: 4 }}>.env</code> del backend:
          </p>
          <div style={{
            background: "var(--bg-page)", borderRadius: 10, padding: 16,
            maxWidth: 480, margin: "0 auto", textAlign: "left",
          }}>
            <pre style={{ fontSize: 13, color: "#A5F3FC", margin: 0, lineHeight: 1.8 }}>
{`DOCUSIGN_INTEGRATION_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DOCUSIGN_USER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DOCUSIGN_ACCOUNT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DOCUSIGN_BASE_URL=https://demo.docusign.net
DOCUSIGN_RSA_PRIVATE_KEY_PATH=docusign_private.pem`}
            </pre>
          </div>
          <p className="text-text-muted" style={{ fontSize: 11, marginTop: 16 }}>
            Consulta el portal de DocuSign Developer para obtener las credenciales.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Contratos & Firmas"
        subtitle="DocuSign eSignature"
        icon={Signature}
        color="#3B82F6"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!loading && apiStatus === "ok" && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: "#16A34A18", color: "#16A34A", border: "1px solid #16A34A40" }}>
                <CheckCircle size={12} weight="fill" /> API conectada
              </span>
            )}
            {!loading && apiStatus === "error" && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ background: "#DC262618", color: "#DC2626", border: "1px solid #DC262640" }}>
                <XCircle size={12} weight="fill" /> Error de API
              </span>
            )}
            {lastSync && (
              <span className="text-text-muted" style={{ fontSize: 11 }}>
                Sync: {lastSync.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="btn-secondary inline-flex items-center gap-1.5"
            >
              <ArrowClockwise size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {kpiCards.map(k => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={loading ? "…" : k.value}
            icon={k.icon}
            color={k.color}
          />
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{
        display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16,
        padding: "12px 14px",
      }}>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="input-field"
          style={{ width: "auto", cursor: "pointer" }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_COLORS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="input-field"
          style={{ width: "auto", cursor: "pointer" }}
        >
          <option value={0}>Sin límite (todos)</option>
          {[7, 14, 30, 60, 90, 180, 365].map(d => (
            <option key={d} value={d}>Últimos {d} días</option>
          ))}
        </select>

        <input
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="Buscar asunto o remitente…"
          className="input-field"
          style={{ flex: 1, minWidth: 180 }}
        />
      </div>

      {/* Tabla de sobres */}
      <div className="card" style={{
        overflow: "hidden",
      }}>
        {/* Cabecera */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 110px 110px 120px",
          padding: "10px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-hover)",
        }}>
          {["Asunto", "Firmantes", "Estado", "Enviado", ""].map(h => (
            <span key={h} className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {h}
            </span>
          ))}
        </div>

        {loading && (
          <div className="text-text-muted" style={{ padding: 32, textAlign: "center" }}>
            Cargando sobres…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Signature size={36} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
            <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              No se encontraron sobres
            </p>
            <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 16, maxWidth: 360, margin: "0 auto 16px" }}>
              Prueba a ampliar el rango de fechas o crear un sobre en DocuSign.
            </p>
            {days !== 0 && (
              <button
                onClick={() => setDays(0)}
                className="btn-primary"
                style={{ fontSize: 13 }}
              >
                Ver todos los períodos
              </button>
            )}
          </div>
        )}

        {!loading && filtered.map((env, i) => (
          <div
            key={env.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 110px 110px 120px",
              padding: "12px 16px",
              borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
              alignItems: "center",
              background: selectedId === env.id ? "var(--bg-hover)" : "transparent",
              transition: "background 0.15s",
            }}
          >
            {/* Asunto */}
            <div style={{ minWidth: 0 }}>
              <p className="text-text-main" style={{
                fontSize: 13, fontWeight: 600,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {env.subject || "Sin asunto"}
              </p>
              <p className="text-text-muted" style={{ fontSize: 11 }}>
                {env.sender_name || env.sender || "—"}
              </p>
            </div>

            {/* Firmantes (avatares) */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(env.recipients || []).slice(0, 5).map((r, ri) => (
                <RecipientAvatar key={ri} r={r} />
              ))}
              {(env.recipients || []).length > 5 && (
                <span className="text-text-muted" style={{ fontSize: 10, alignSelf: "center" }}>
                  +{env.recipients.length - 5}
                </span>
              )}
            </div>

            {/* Estado */}
            <div>
              <Badge status={env.status} variant="pill" colorMap={STATUS_COLORS} />
            </div>

            {/* Enviado */}
            <span className="text-text-muted" style={{ fontSize: 11 }}>
              {env.sent_at ? formatDate(env.sent_at) : "—"}
            </span>

            {/* Acción */}
            <div style={{ display: "flex", gap: 4 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedId(selectedId === env.id ? null : env.id)}
              >
                Ver detalle
              </Button>
              {env.status === "completed" && (
                <button
                  onClick={() => handleDownload(env.id)}
                  disabled={downloading[env.id]}
                  title="Descargar PDF firmado"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "5px 8px", borderRadius: 7,
                    border: "1px solid #16A34A40", background: "#16A34A15",
                    color: "#16A34A", cursor: downloading[env.id] ? "wait" : "pointer",
                  }}
                >
                  {downloading[env.id]
                    ? <ArrowClockwise size={14} className="animate-spin" />
                    : <DownloadSimple size={14} weight="bold" />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Panel lateral */}
      <AnimatePresence>
        {selectedId && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 35, background: "transparent" }}
              onClick={() => setSelectedId(null)}
            />
            <DetailPanel
              envelopeId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
