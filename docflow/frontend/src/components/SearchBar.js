import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass, House, Briefcase, FolderOpen, EnvelopeSimple,
  ChartBar, Database, Lightning, Gear, Moon, Sun, Translate, HardDrives,
} from "@phosphor-icons/react";
import api from "../services/api";
import { getStatusColor } from "../constants/status";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";

export default function SearchBar({ onNavigate }) {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const PAGE_ENTRIES = useMemo(() => [
    { label: t('navInicio'), section: "inicio", icon: House },
    { label: t('navProyectos'), section: "proyectos", icon: Briefcase },
    { label: `${t('navProyectos')} > ${t('tabOverview')}`, section: "proyectos", icon: Briefcase },
    { label: `${t('navProyectos')} > ${t('tabTracking')}`, section: "proyectos", icon: Briefcase },
    { label: `${t('navProyectos')} > ${t('tabUrgencies')}`, section: "proyectos", icon: Briefcase },
    { label: t('navDocumentos'), section: "documentos", icon: FolderOpen },
    { label: `${t('navDocumentos')} > ${t('tabRegistro')}`, section: "documentos", icon: FolderOpen },
    { label: `${t('navDocumentos')} > ${t('tabTablero')}`, section: "documentos", icon: FolderOpen },
    { label: t('navComunicaciones'), section: "comunicaciones", icon: EnvelopeSimple },
    { label: `${t('navComunicaciones')} > ${t('tabBandeja')}`, section: "comunicaciones", icon: EnvelopeSimple },
    { label: `${t('navComunicaciones')} > ${t('tabReclamaciones')}`, section: "comunicaciones", icon: EnvelopeSimple },
    { label: `${t('navComunicaciones')} > ${t('tabFirmas')}`, section: "comunicaciones", icon: EnvelopeSimple },
    { label: t('navInformes'), section: "informes", icon: ChartBar },
    { label: `${t('navInformes')} > ${t('tabRendimiento')}`, section: "informes", icon: ChartBar },
    { label: `${t('navInformes')} > ${t('tabReportCenter')}`, section: "informes", icon: ChartBar },
    { label: t('navErp'), section: "erp", icon: Database },
    { label: t('navFlujos'), section: "flujos", icon: Lightning },
    { label: t('navConfiguracion'), section: "configuracion", icon: Gear },
    { label: `${t('navConfiguracion')} > ${t('tabEquipo')}`, section: "configuracion", icon: Gear },
    { label: `${t('navConfiguracion')} > ${t('settingsTemplates')}`, section: "configuracion", icon: Gear },
    { label: `${t('navConfiguracion')} > ${t('settingsSystem')}`, section: "configuracion", icon: Gear },
  ], [t]);

  const ACTION_ENTRIES = useMemo(() => [
    { label: theme === "dark" ? t('sbSwitchLightTheme') : t('sbSwitchDarkTheme'), action: toggleTheme, icon: theme === "dark" ? Sun : Moon, type: "action" },
    { label: lang === "es" ? t('sbSwitchEnglish') : t('sbSwitchSpanish'), action: toggleLang, icon: Translate, type: "action" },
    { label: t('sbRunBackup'), action: () => { api.post("/backup/trigger").catch(() => {}); }, icon: HardDrives, type: "action" },
  ], [theme, toggleTheme, lang, toggleLang, t]);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filter pages/actions by query
  const paletteItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...PAGE_ENTRIES.slice(0, 5), ...ACTION_ENTRIES];
    const pages = PAGE_ENTRIES.filter(p => p.label.toLowerCase().includes(q));
    const actions = ACTION_ENTRIES.filter(a => a.label.toLowerCase().includes(q));
    return [...pages, ...actions];
  }, [query, PAGE_ENTRIES, ACTION_ENTRIES]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setOpen(true);
    try {
      const res = await api.post("/search/natural", { query: query.trim() });
      setResults(res.data);
    } catch (err) {
      setResults({ error: err.response?.data?.detail || "Error en la búsqueda" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (selectedIdx >= 0 && selectedIdx < paletteItems.length && !results) {
        handlePaletteClick(paletteItems[selectedIdx]);
      } else {
        handleSearch();
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, paletteItems.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    }
  };

  const handlePaletteClick = (item) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    if (item.action) {
      item.action();
    } else if (item.section && onNavigate) {
      onNavigate({ _navSection: item.section });
    }
  };

  const handleResultClick = (item) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    if (onNavigate) onNavigate(item);
  };

  const showPalette = open && !results && !loading;
  const showResults = open && results;

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", maxWidth: 480 }}>
      {/* Input */}
      <div className="bg-card rounded-lg" style={styles.inputWrapper}>
        <MagnifyingGlass size={16} className="text-text-muted" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setResults(null); setSelectedIdx(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={t('sbSearchPlaceholder')}
          className="text-text-main"
          style={styles.input}
        />
        {loading && <span className="text-text-muted" style={styles.spinner}>...</span>}
        <kbd className="text-text-muted" style={{
          fontSize: 9, fontWeight: 600, padding: "1px 5px",
          borderRadius: 4, border: "1px solid var(--border)",
          background: "var(--bg-hover)", lineHeight: "14px",
        }}>
          Ctrl+K
        </kbd>
      </div>

      {/* Command Palette */}
      <AnimatePresence>
        {showPalette && paletteItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-card border border-border rounded-lg"
            style={styles.dropdown}
          >
            <div className="text-text-muted" style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
              {query.trim() ? t('sbResults') : t('sbQuickAccess')}
            </div>
            {paletteItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  onClick={() => handlePaletteClick(item)}
                  style={{
                    ...styles.resultRow,
                    display: "flex", alignItems: "center", gap: 10,
                    backgroundColor: i === selectedIdx ? "var(--bg-hover)" : "transparent",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; setSelectedIdx(i); }}
                  onMouseLeave={(e) => { if (i !== selectedIdx) e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  {Icon && <Icon size={14} className="text-text-muted" style={{ flexShrink: 0 }} />}
                  <span className="text-text-main" style={{ fontSize: 13 }}>{item.label}</span>
                  {item.type === "action" && (
                    <span className="text-text-muted" style={{ marginLeft: "auto", fontSize: 10 }}>{t('sbAction')}</span>
                  )}
                  {!item.type && !item.action && (
                    <span className="text-text-muted" style={{ marginLeft: "auto", fontSize: 10 }}>{t('sbPage')}</span>
                  )}
                </div>
              );
            })}
            {query.trim() && (
              <div
                onClick={handleSearch}
                style={{ ...styles.resultRow, display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid var(--border)" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <MagnifyingGlass size={14} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                  {t('sbSearchInDocs').replace('{query}', query)}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Results */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-card border border-border rounded-lg"
            style={styles.dropdown}
          >
            {results.error ? (
              <div style={styles.errorRow}>{results.error}</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderBottom: "1px solid var(--border)" }}>
                  <span className="text-text-muted" style={{ fontSize: 11 }}>
                    {results.count} resultado{results.count !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => { setResults(null); setSelectedIdx(-1); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--accent)", fontWeight: 600 }}
                  >
                    {t('back')}
                  </button>
                </div>
                {results.results && results.results.length > 0 ? (
                  <div style={styles.resultsList}>
                    {results.results.slice(0, 50).map((item, i) => (
                      <div
                        key={i}
                        style={styles.resultRow}
                        onClick={() => handleResultClick(item)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--bg-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <div style={styles.resultTitle}>
                          <span className="text-text-main" style={styles.docNumber}>{item["Nº Doc. EIPSA"] || "-"}</span>
                          <span className="text-text-main" style={styles.titleText}>{item["Título"] || t('sbNoTitle')}</span>
                        </div>
                        <div className="text-text-muted" style={styles.resultMeta}>
                          <span>{item["Cliente"] || ""}</span>
                          <span style={styles.badge(item["Estado"])}>{item["Estado"] || t('statusNotSent')}</span>
                          <span>Rev. {item["Nº Revisión"] || "-"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-text-muted" style={styles.emptyRow}>{t('noResults')}</div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles = {
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    padding: "6px 12px",
    gap: 8,
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    backgroundColor: "transparent",
    fontSize: 14,
  },
  spinner: {
    fontSize: 14,
    color: "var(--text-muted)",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    boxShadow: "var(--shadow-dropdown)",
    zIndex: 1000,
    maxHeight: 420,
    overflowY: "auto",
  },
  resultsList: {
    maxHeight: 370,
    overflowY: "auto",
  },
  resultRow: {
    padding: "8px 12px",
    cursor: "pointer",
    borderBottom: "1px solid var(--border)",
    transition: "background-color 0.15s",
  },
  resultTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  docNumber: {
    fontWeight: 600,
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  titleText: {
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  resultMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
  },
  badge: (estado) => {
    const c = getStatusColor(estado);
    return {
      backgroundColor: c.bg,
      color: c.text,
      padding: "1px 6px",
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      border: `1px solid ${c.border}`,
    };
  },
  errorRow: {
    padding: "12px",
    color: "#DC2626",
    fontSize: 13,
  },
  emptyRow: {
    padding: "12px",
    fontSize: 13,
    textAlign: "center",
  },
};
