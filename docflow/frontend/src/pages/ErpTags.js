import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import { useToast } from "../contexts/ToastContext";
import SkeletonCard from "../components/SkeletonCard";
import PageHeader from "../components/PageHeader";
import { MagnifyingGlass, CaretDown, CaretRight, TagSimple } from "@phosphor-icons/react";
import { TAG_STATUS_COLORS } from "../constants/status";
import { useI18n } from "../contexts/I18nContext";

function TagStatusBadge({ status }) {
  if (!status || status === "—") return <span className="text-text-muted" style={{ fontSize: 13 }}>—</span>;
  const key = String(status).toLowerCase();
  const color = TAG_STATUS_COLORS[key] || "#6B7280";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 700, color,
      background: color + "18", borderRadius: 6, padding: "2px 8px",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
      {status}
    </span>
  );
}

function DetailSection({ title, fields, data }) {
  const visibleFields = fields.filter(({ key }) => {
    const val = data[key];
    return val !== "" && val !== null && val !== undefined && val !== 0 && val !== "0" && val !== "—";
  });
  if (visibleFields.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "var(--accent)",
        textTransform: "uppercase", letterSpacing: "0.07em",
        marginBottom: 8, paddingBottom: 4,
        borderBottom: "1px solid var(--border)",
      }}>
        {title}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "6px 16px" }}>
        {visibleFields.map(({ label, key }) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {label}
            </span>
            <span className="text-text-main" style={{ fontSize: 13, wordBreak: "break-word" }}>
              {String(data[key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DETAIL_SECTIONS = [
  {
    title: "Identificación",
    fields: [
      { label: "ID", key: "ID" },
      { label: "TAG", key: "TAG" },
      { label: "Estado", key: "Estado" },
      { label: "Nº Oferta", key: "Nº Oferta" },
      { label: "Nº Pedido", key: "Nº Pedido" },
      { label: "PO", key: "PO" },
      { label: "Posición", key: "Posición" },
      { label: "Subposición", key: "Subposición" },
      { label: "Tipo", key: "Tipo" },
    ],
  },
  {
    title: "Especificaciones de Línea",
    fields: [
      { label: "Tamaño Línea", key: "Tamaño Línea" },
      { label: "Rating", key: "Rating" },
      { label: "Facing", key: "Facing" },
      { label: "Schedule", key: "Schedule" },
      { label: "Pipe Spec.", key: "Pipe Spec." },
      { label: "NACE", key: "NACE" },
      { label: "Nº Saltos", key: "Nº Saltos" },
    ],
  },
  {
    title: "Materiales",
    fields: [
      { label: "Mat. Brida", key: "Mat. Brida" },
      { label: "Tipo Brida", key: "Tipo Brida" },
      { label: "Mat. Tubo", key: "Mat. Tubo" },
      { label: "Mat. Elemento", key: "Mat. Elemento" },
      { label: "Mat. Junta", key: "Mat. Junta" },
      { label: "Mat. Torn.", key: "Mat. Torn." },
      { label: "Mat. Tuercas", key: "Mat. Tuercas" },
      { label: "Mat. Tapón", key: "Mat. Tapón" },
      { label: "Mat. Extractor", key: "Mat. Extractor" },
      { label: "Mat. Porta RTJ", key: "Mat. Porta RTJ" },
      { label: "Con. Vlv.", key: "Con. Vlv." },
      { label: "Mat. Cuerpo Vlv.", key: "Mat. Cuerpo Vlv." },
      { label: "Mat. Conos Vent.", key: "Mat. Conos Vent." },
    ],
  },
  {
    title: "Elemento / Placa",
    fields: [
      { label: "Tipo Placa", key: "Tipo Placa" },
      { label: "Esp. Placa", key: "Esp. Placa" },
      { label: "Std Placa", key: "Std Paca" },
      { label: "øOrif. (mm)", key: "øOrif. (mm)" },
      { label: "øD/V (mm)", key: "øD/V (mm)" },
      { label: "Tipo RTJ", key: "Tipo RTJ" },
    ],
  },
  {
    title: "Tomas",
    fields: [
      { label: "Tamaño Tomas", key: "Tamaño Tomas" },
      { label: "Nº Tomas", key: "Nº Tomas" },
      { label: "Orient. Tomas", key: "Orient. Tomas" },
    ],
  },
  {
    title: "Tornillería y Juntas",
    fields: [
      { label: "Tamaño Torn.", key: "Tamaño Torn." },
      { label: "Cant. Torn", key: "Cant. Torn" },
      { label: "Cant. Juntas", key: "Cant. Juntas" },
      { label: "Espesor RTJ", key: "Espesor RTJ" },
      { label: "Tamaño Extractor", key: "Tamaño Extractor" },
      { label: "Cant. Extractor", key: "Cant. Extractor" },
      { label: "Cant. Tapón", key: "Cant. Tapón" },
    ],
  },
  {
    title: "Dimensiones",
    fields: [
      { label: "Peso (mm)", key: "Peso (mm)" },
      { label: "Long. (mm)", key: "Long. (mm)" },
      { label: "øInt. Línea", key: "øInt. Línea" },
      { label: "øExt. Placa", key: "øExt. Placa" },
      { label: "Cota C Placa", key: "Cota C Placa" },
      { label: "Alto Mango", key: "Alto Mango" },
      { label: "Ancho Mango", key: "Ancho Mango" },
      { label: "Espesor Mango", key: "Espesor Mango" },
      { label: "Cota P RTJ", key: "Cota P RTJ" },
      { label: "Cota E RTJ", key: "Cota E RTJ" },
      { label: "Cota F RTJ", key: "Cota F RTJ" },
      { label: "O Brida", key: "O Brida" },
      { label: "A Brida", key: "A Brida" },
      { label: "C Brida", key: "C Brida" },
      { label: "Y Brida", key: "Y Brida" },
      { label: "X Brida", key: "X Brida" },
      { label: "R Brida", key: "R Brida" },
      { label: "D Brida", key: "D Brida" },
      { label: "T Brida", key: "T Brida" },
      { label: "øBore Torn.", key: "øBore Torn." },
      { label: "A Venturi", key: "A Venturi" },
      { label: "D Venturi", key: "D Venturi" },
      { label: "E Venturi", key: "E Venturi" },
      { label: "F Venturi", key: "F Venturi" },
      { label: "G Venturi", key: "G Venturi" },
      { label: "C Venturi", key: "C Venturi" },
      { label: "H Venturi", key: "H Venturi" },
      { label: "T Venturi", key: "T Venturi" },
    ],
  },
  {
    title: "Documentación",
    fields: [
      { label: "Doc EIPSA Calc.", key: "Doc EIPSA Calc." },
      { label: "Doc EIPSA Plano", key: "Doc EIPSA Plano" },
      { label: "Plano Dim.", key: "Plano Dim." },
      { label: "Rev. Plano Dim.", key: "Rev. Plano Dim." },
      { label: "Fecha Plano Dim.", key: "Fecha Plano Dim." },
      { label: "Plano OF", key: "Plano OF" },
      { label: "Rev. Plano OF", key: "Rev. Plano OF" },
      { label: "Fecha Plano OF", key: "Fecha Plano OF" },
      { label: "Orden de Compra", key: "Orden de Compra" },
      { label: "Fecha Orden Compra", key: "Fecha Orden Compra" },
      { label: "Notas Orden Compra", key: "Notas Orden Compra" },
    ],
  },
  {
    title: "Fabricación e Inspección",
    fields: [
      { label: "Estado Fab.", key: "Estado Fab." },
      { label: "Inspeccion", key: "Inspeccion" },
      { label: "Fecha IRC", key: "Fecha IRC" },
      { label: "Colada Placa", key: "Colada Placa" },
      { label: "Cert. Placa", key: "Cert. Placa" },
      { label: "Colada Brida", key: "Colada Brida" },
      { label: "Cert. Brida", key: "Cert. Brida" },
      { label: "Fecha PMI", key: "Fecha PMI" },
      { label: "Fecha PH1", key: "Fecha PH1" },
      { label: "Fecha PH2", key: "Fecha PH2" },
      { label: "Fecha LP", key: "Fecha LP" },
      { label: "Fecha Dureza", key: "Fecha Dureza" },
      { label: "Fecha Verif. Dim.", key: "Fecha Verif. Dim." },
      { label: "Estado Verif. Dim.", key: "Estado Verif. Dim." },
      { label: "Notas Verif. Dim", key: "Notas Verif. Dim" },
      { label: "Fecha Verif. OF", key: "Fecha Verif. OF" },
      { label: "Estado Verif. OF", key: "Estado Verif. OF" },
      { label: "Notas Verif. OF", key: "Notas Verif. OF" },
      { label: "Envío RN", key: "Envío RN" },
      { label: "Fecha RN", key: "Fecha RN" },
    ],
  },
  {
    title: "Notas",
    fields: [
      { label: "Notas Oferta", key: "Notas Oferta" },
      { label: "Cambios Com.", key: "Cambios Com." },
      { label: "Fecha Contr.", key: "Fecha Contr." },
      { label: "Cambios Tec.", key: "Cambios Tec." },
      { label: "Notas Tec.", key: "Notas Tec." },
      { label: "Notas Equipo", key: "Notas Equipo" },
      { label: "Notas Brida", key: "Notas Brida" },
      { label: "Notas Tornillos", key: "Notas Tornillos" },
      { label: "Notas Tuercas", key: "Notas Tuercas" },
      { label: "Notas Placa", key: "Notas Placa" },
      { label: "Notas Junta", key: "Notas Junta" },
      { label: "Notas Tapones", key: "Notas Tapones" },
      { label: "Notas Extractor", key: "Notas Extractor" },
    ],
  },
  {
    title: "Fotos y Planos",
    fields: [
      { label: "Fotos", key: "Fotos" },
      { label: "Fotos 2", key: "Fotos 2" },
      { label: "Ruta Dim.", key: "Ruta Dim." },
      { label: "Ruta OF", key: "Ruta OF" },
    ],
  },
];

const SUMMARY_HEADERS = ["TAG", "Nº Pedido", "Tipo", "Tamaño Línea", "Rating", "Facing", "Schedule", "Estado Fab."];

export default function ErpTags() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTag, setExpandedTag] = useState(null);

  const fetchTags = async (pedido = "") => {
    setLoading(true);
    setExpandedTag(null);
    try {
      const url = pedido ? `/erp/tags?pedido=${encodeURIComponent(pedido)}` : "/erp/tags";
      const res = await api.get(url);
      setTags(res.data);
    } catch (err) {
      console.error("Error cargando tags:", err);
      showToast("Error al cargar tags", "error");
      setTags([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTags(); }, []);

  const handleSearch = () => fetchTags(query.trim());

  const handleClear = () => {
    setQuery("");
    setFilterEstado("");
    fetchTags("");
  };

  const filtered = filterEstado
    ? tags.filter(tag => (tag["Estado Fab."] || "").toLowerCase() === filterEstado.toLowerCase())
    : tags;

  const estadoOptions = [...new Set(tags.map(tag => tag["Estado Fab."]).filter(Boolean))].sort();

  const toggleRow = (id) => setExpandedTag(prev => prev === id ? null : id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Tags e Inspecciones" description={t('etTitle')} />

      {/* Filtros */}
      <div className="card" style={{
        padding: 16,
        display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end",
      }}>
        {/* Nº Pedido */}
        <div style={{ flex: "1 1 200px" }}>
          <label className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
            Nº Pedido
          </label>
          <div style={{ position: "relative" }}>
            <MagnifyingGlass size={15} color="var(--text-muted)" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Ej: P-25/049"
              className="input-field"
              style={{ height: 38, paddingLeft: 34 }}
            />
          </div>
        </div>

        {/* Estado Fab. */}
        <div style={{ flex: "1 1 160px" }}>
          <label className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
            Estado Fab.
          </label>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="input-field"
            style={{ height: 38, cursor: "pointer" }}
          >
            <option value="">Todos</option>
            {estadoOptions.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: 8 }}>
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
            {loading ? t('loading') : t('filterApply')}
          </motion.button>
          {(query || filterEstado) && (
            <motion.button
              onClick={handleClear}
              whileTap={{ scale: 0.95 }}
              className="btn-secondary"
              style={{ height: 38, padding: "0 14px" }}>
              Limpiar
            </motion.button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3,4].map(i => <SkeletonCard key={i} height={44} />)}
        </div>
      )}

      {/* Tabla */}
      {!loading && (
        <div className="card" style={{ overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <TagSimple size={48} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px", display: "block", opacity: 0.5 }} />
              <p className="text-text-main" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sin tags encontrados</p>
              <p className="text-text-muted" style={{ fontSize: 12 }}>
                {query || filterEstado ? "Prueba ajustando los filtros de búsqueda" : "No hay tags disponibles en el sistema"}
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-sidebar)" }}>
                      {/* col expand indicator */}
                      <th style={{ width: 32, padding: "10px 8px", borderBottom: "1px solid var(--border)" }} />
                      {SUMMARY_HEADERS.map((h) => (
                        <th key={h} className="text-text-muted" style={{
                          textAlign: "left", padding: "10px 14px",
                          borderBottom: "1px solid var(--border)",
                          fontWeight: 700,
                          fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
                          whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tag, idx) => {
                      const tagId = tag["ID"] ?? tag["TAG"] ?? idx;
                      const isOpen = expandedTag === tagId;
                      return (
                        <React.Fragment key={tagId}>
                          <tr
                            onClick={() => toggleRow(tagId)}
                            style={{
                              borderBottom: isOpen ? "none" : "1px solid var(--border)",
                              background: isOpen ? "var(--accent)10" : (idx % 2 === 0 ? "transparent" : "var(--bg-hover)"),
                              cursor: "pointer",
                              transition: "background 0.15s",
                            }}
                          >
                            <td className="text-text-muted" style={{ padding: "8px 8px", textAlign: "center" }}>
                              {isOpen
                                ? <CaretDown size={13} weight="bold" />
                                : <CaretRight size={13} weight="bold" />}
                            </td>
                            <td style={{ padding: "8px 14px", fontWeight: 700, color: "var(--accent)", whiteSpace: "nowrap" }}>
                              {tag["TAG"] || "—"}
                            </td>
                            <td className="text-text-sub" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                              {tag["Nº Pedido"] || "—"}
                            </td>
                            <td className="text-text-sub" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                              {tag["Tipo"] || "—"}
                            </td>
                            <td className="text-text-sub" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                              {tag["Tamaño Línea"] || "—"}
                            </td>
                            <td className="text-text-sub" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                              {tag["Rating"] || "—"}
                            </td>
                            <td className="text-text-sub" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                              {tag["Facing"] || "—"}
                            </td>
                            <td className="text-text-sub" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                              {tag["Schedule"] || "—"}
                            </td>
                            <td style={{ padding: "8px 14px" }}>
                              <TagStatusBadge status={tag["Estado Fab."]} />
                            </td>
                          </tr>

                          {/* Panel de detalle */}
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                <td colSpan={SUMMARY_HEADERS.length + 1} style={{ padding: 0 }}>
                                  <motion.div
                                    key="detail"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.22 }}
                                    style={{ overflow: "hidden" }}
                                  >
                                    <div style={{
                                      padding: 20,
                                      background: "var(--bg-page)",
                                      borderTop: "1px solid var(--border)",
                                    }}>
                                      {DETAIL_SECTIONS.map(section => (
                                        <DetailSection
                                          key={section.title}
                                          title={section.title}
                                          fields={section.fields}
                                          data={tag}
                                        />
                                      ))}
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)" }}>
                <span className="text-text-muted" style={{ fontSize: 11 }}>
                  {filtered.length} tag{filtered.length !== 1 ? "s" : ""}
                  {filterEstado ? ` · filtrado por "${filterEstado}"` : ""}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
