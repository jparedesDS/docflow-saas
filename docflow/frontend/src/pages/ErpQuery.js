import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import { MagnifyingGlass, Package } from "@phosphor-icons/react";
import { formatDateISO as formatDate } from "../utils/dates";
import { useI18n } from "../contexts/I18nContext";

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

function InfoItem({ label, value }) {
  return (
    <div>
      <span className="text-text-muted" style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>{label}</span>
      <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value || "—"}</p>
    </div>
  );
}

function PhaseCard({ title, pct, date, obs }) {
  const n = parseInt(pct) || 0;
  let barColor = "#DC2626";
  if (n >= 100) barColor = "#16A34A";
  else if (n >= 50) barColor = "#D97706";
  else if (n > 0) barColor = "#CA8A04";

  return (
    <div style={{
      borderRadius: 10, border: `1px solid ${barColor}30`,
      background: barColor + "0A", padding: 14,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <span className="text-text-muted" style={{ fontSize: 11 }}>{formatDate(date)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(n, 100)}%` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ height: "100%", background: barColor, borderRadius: 4 }}
          />
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: barColor, minWidth: 36, textAlign: "right" }}>{n}%</span>
      </div>
      {obs && <p className="text-text-muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>{obs}</p>}
    </div>
  );
}


export default function ErpQuery() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setResults([]);
    try {
      const res = await api.get(`/erp/consulta?query=${encodeURIComponent(query.trim())}&column=${encodeURIComponent("Nº Pedido")}`);
      setResults(res.data);
    } catch (err) {
      console.error("Error:", err);
      showToast("Error en la consulta ERP", "error");
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Consulta ERP" description={t('eqTitle')} />

      {/* Buscador */}
      <div className="card" style={{ padding: 16 }}>
        <label className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
          Buscar por Nº Pedido
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <MagnifyingGlass size={15} color="var(--text-muted)" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t('eqPlaceholder')}
              className="input-field"
              style={{ height: 38, paddingLeft: 34 }}
            />
          </div>
          <motion.button
            onClick={handleSearch}
            disabled={loading}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            className="btn-primary"
            style={{
              height: 38, padding: "0 22px",
              cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "var(--text-muted)" : undefined,
            }}>
            {loading ? t('loading') : t('search')}
          </motion.button>
        </div>
      </div>

      {/* Estado inicial */}
      {!searched && !loading && (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <Package size={48} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px", display: "block", opacity: 0.5 }} />
          <p className="text-text-main" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t('eqTitle')}</p>
          <p className="text-text-muted" style={{ fontSize: 12 }}>
            {t('eqPlaceholder')}
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SkeletonCard height={56} />
          <SkeletonCard height={180} />
        </div>
      )}

      {/* Sin resultados */}
      <AnimatePresence>
        {searched && !loading && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-lg"
            style={{
              padding: 16,
              background: "#CA8A0418", border: "1px solid #CA8A0440",
              color: "#CA8A04", fontSize: 13, fontWeight: 600,
            }}>
            No se encontraron resultados para "{query}"
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resultados */}
      <motion.div variants={stagger} initial="hidden" animate="visible" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {results.map((row, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            className="card"
            style={{ overflow: "hidden" }}>
            {/* Header pedido */}
            <div style={{
              background: "var(--bg-sidebar)", padding: "12px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>{row["Nº Pedido"]}</span>
                {row["Cliente"] && <span className="text-text-muted" style={{ fontSize: 13 }}>{row["Cliente"]}</span>}
              </div>
              {row["Año"] && <span className="text-text-muted" style={{ fontSize: 11, background: "var(--bg-hover)", padding: "2px 8px", borderRadius: 4 }}>{row["Año"]}</span>}
            </div>

            <div style={{ padding: 20 }}>
              {/* Info grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16, marginBottom: 20 }}>
                <InfoItem label={t('eqProject')} value={row["Proyecto"]} />
                <InfoItem label={t('eqResponsible')} value={row["Responsable"]} />
                <InfoItem label={t('eqFinalClient')} value={row["Cl. Final / Planta"]} />
                <InfoItem label={t('eqEquipmentType')} value={row["Tipo Equipo"]} />
                <InfoItem label="Nº Equipos" value={row["Nº Equipos"]} />
                <InfoItem label="Nº Oferta" value={row["Nº Oferta"]} />
                <InfoItem label="Fecha Pedido" value={formatDate(row["Fecha Pedido"])} />
                <InfoItem label="Fecha Prevista" value={formatDate(row["Fecha Prevista"])} />
              </div>

              {/* Fases */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <PhaseCard title="Fabricación" pct={row["% Fabricación"]} date={row["Fecha Fabricación"]} obs={row["Obs. Fabricación"]} />
                <PhaseCard title="Montaje" pct={row["% Montaje"]} date={row["Fecha Montaje"]} obs={row["Obs. Montaje"]} />
                <PhaseCard title="Envío" pct={row["% Envío"]} date={row["Fecha Envío"]} obs={row["Obs. Envío"]} />
              </div>

              {/* Notas */}
              {row["Notas Pedido"] && (
                <div className="border border-border rounded-lg" style={{ marginTop: 16, background: "var(--bg-hover)", padding: 12 }}>
                  <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Notas</span>
                  <p className="text-text-sub" style={{ fontSize: 13, marginTop: 4 }}>{row["Notas Pedido"]}</p>
                </div>
              )}

            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
