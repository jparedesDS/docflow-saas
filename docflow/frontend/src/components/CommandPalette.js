import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass, File, Folder, EnvelopeSimple, X,
  ArrowRight, ArrowElbowDownLeft, CaretUp, CaretDown,
} from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { useTheme } from "../contexts/ThemeContext";
import { getStatusColor } from "../constants/status";

const CATEGORY_ICONS = {
  document: File,
  pedido: Folder,
  claim: EnvelopeSimple,
};


export default function CommandPalette({ isOpen, onClose, onNavigate }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const debounceRef = useRef(null);

  const getCategoryLabel = (category) => ({
    document: t("cpDocuments") || "Documentos",
    pedido: t("cpOrders") || "Pedidos",
    claim: t("cpClaims") || "Reclamaciones",
  }[category] || category);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults(null);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  const performSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get("/search/unified", { params: { q: q.trim(), limit: 20 } });
      setResults(res.data);
      setSelectedIndex(0);
    } catch {
      setResults({ results: [], total: 0, categories: {}, query: q });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    if (query.trim().length < 2) return;
    setLoading(true);
    debounceRef.current = setTimeout(() => performSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, performSearch]);

  // Flatten results for keyboard navigation
  const flatResults = results?.results || [];

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const items = resultsRef.current.querySelectorAll("[data-result-item]");
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && flatResults.length > 0) {
      e.preventDefault();
      handleResultClick(flatResults[selectedIndex]);
      return;
    }
  };

  const handleResultClick = (item) => {
    if (!item) return;
    const category = item.category;
    let section = "documentos";
    if (category === "pedido") section = "proyectos";
    if (category === "claim") section = "herramientas";
    onNavigate(section);
    onClose();
  };

  // Group results by category for display
  const groupedResults = {};
  if (flatResults.length > 0) {
    for (const item of flatResults) {
      const cat = item.category || "other";
      if (!groupedResults[cat]) groupedResults[cat] = [];
      groupedResults[cat].push(item);
    }
  }

  // Build flat index mapping for keyboard navigation
  let globalIdx = 0;
  const indexMap = {};
  for (const cat of Object.keys(groupedResults)) {
    for (let i = 0; i < groupedResults[cat].length; i++) {
      indexMap[globalIdx] = { cat, i };
      globalIdx++;
    }
  }

  const overlayBg = isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.5)";

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "15vh",
            background: overlayBg,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: "100%",
              maxWidth: 620,
              borderRadius: 16,
              background: "var(--bg-card)",
              boxShadow: isDark
                ? "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)"
                : "0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.08)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
            }}>
              <MagnifyingGlass
                size={20}
                weight="bold"
                style={{ color: "var(--accent)", flexShrink: 0 }}
              />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={flatResults.length > 0}
                aria-controls="cp-results-listbox"
                aria-activedescendant={flatResults.length > 0 ? `cp-result-${selectedIndex}` : undefined}
                aria-autocomplete="list"
                aria-haspopup="listbox"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("cpSearchPlaceholder")}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 16,
                  color: "var(--text-main)",
                  fontFamily: "Inter, sans-serif",
                }}
              />
              {loading && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  style={{
                    width: 18, height: 18,
                    border: "2px solid var(--border)",
                    borderTopColor: "var(--accent)",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                />
              )}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "Inter, monospace",
                }}
              >
                ESC
              </button>
            </div>

            {/* Results area */}
            <div
              ref={resultsRef}
              id="cp-results-listbox"
              role="listbox"
              aria-label={t("cpResults")}
              style={{
                maxHeight: 400,
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              {/* Empty state - no query */}
              {!query.trim() && (
                <div style={{
                  padding: "32px 20px",
                  textAlign: "center",
                }}>
                  <MagnifyingGlass
                    size={40}
                    weight="thin"
                    style={{ color: "var(--text-muted)", marginBottom: 12, opacity: 0.5 }}
                  />
                  <p style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    margin: "0 0 16px",
                  }}>
                    {t("cpTypeToSearch")}
                  </p>
                  <div style={{
                    display: "flex",
                    gap: 16,
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}>
                    {[
                      { icon: File, label: getCategoryLabel("document") },
                      { icon: Folder, label: getCategoryLabel("pedido") },
                      { icon: EnvelopeSimple, label: getCategoryLabel("claim") },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} style={{
                          display: "flex", alignItems: "center", gap: 6,
                          fontSize: 12, color: "var(--text-muted)",
                        }}>
                          <Icon size={14} />
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Loading with no results yet */}
              {query.trim().length >= 2 && loading && !results && (
                <div style={{
                  padding: "24px 20px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: 13,
                }}>
                  {t("loading")}
                </div>
              )}

              {/* No results */}
              {results && flatResults.length === 0 && !loading && (
                <div style={{
                  padding: "32px 20px",
                  textAlign: "center",
                }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
                    {t("cpNoResults")}
                  </p>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "4px 0 0", opacity: 0.7 }}>
                    &ldquo;{results.query}&rdquo;
                  </p>
                </div>
              )}

              {/* Grouped results */}
              {Object.keys(groupedResults).map((cat) => {
                const CatIcon = CATEGORY_ICONS[cat] || File;
                const items = groupedResults[cat];
                return (
                  <div key={cat}>
                    {/* Category header */}
                    <div style={{
                      padding: "8px 20px 4px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}>
                      <CatIcon size={12} style={{ color: "var(--text-muted)" }} />
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--text-muted)",
                      }}>
                        {getCategoryLabel(cat)}
                      </span>
                      <span style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        opacity: 0.6,
                      }}>
                        {items.length}
                      </span>
                    </div>

                    {/* Category items */}
                    {items.map((item) => {
                      const itemGlobalIndex = flatResults.indexOf(item);
                      const isSelected = itemGlobalIndex === selectedIndex;
                      const statusColor = item.estado ? getStatusColor(item.estado) : null;
                      const ItemIcon = CATEGORY_ICONS[item.category] || File;

                      return (
                        <div
                          key={item.id}
                          id={`cp-result-${itemGlobalIndex}`}
                          role="option"
                          aria-selected={isSelected}
                          data-result-item
                          onClick={() => handleResultClick(item)}
                          onMouseEnter={() => setSelectedIndex(itemGlobalIndex)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 20px",
                            cursor: "pointer",
                            backgroundColor: isSelected
                              ? (isDark ? "rgba(99,102,241,0.12)" : "rgba(79,70,229,0.06)")
                              : "transparent",
                            transition: "background-color 0.1s",
                            borderLeft: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                          }}
                        >
                          {/* Icon */}
                          <div style={{
                            width: 32, height: 32,
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                            flexShrink: 0,
                          }}>
                            <ItemIcon
                              size={16}
                              weight={isSelected ? "fill" : "regular"}
                              style={{ color: isSelected ? "var(--accent)" : "var(--text-muted)" }}
                            />
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}>
                              <span style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--text-main)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}>
                                {item.title}
                              </span>
                              {statusColor && item.estado && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  backgroundColor: statusColor.bg,
                                  color: statusColor.text,
                                  border: `1px solid ${statusColor.border}`,
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}>
                                  {item.estado || t("statusNotSent")}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <p style={{
                                fontSize: 12,
                                color: "var(--text-muted)",
                                margin: "1px 0 0",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}>
                                {item.subtitle}
                              </p>
                            )}
                            {item.description && (
                              <p style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                margin: "1px 0 0",
                                opacity: 0.7,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}>
                                {item.description}
                              </p>
                            )}
                          </div>

                          {/* Arrow hint */}
                          {isSelected && (
                            <ArrowRight
                              size={14}
                              style={{ color: "var(--accent)", flexShrink: 0 }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer with keyboard hints */}
            {(flatResults.length > 0 || query.trim()) && (
              <div style={{
                padding: "8px 20px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}>
                {flatResults.length > 0 && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <kbd style={kbdStyle}>
                        <ArrowElbowDownLeft size={10} />
                      </kbd>
                      <span style={hintStyle}>{t("cpPressEnter")}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <kbd style={kbdStyle}><CaretUp size={10} /></kbd>
                      <kbd style={kbdStyle}><CaretDown size={10} /></kbd>
                      <span style={hintStyle}>{t("cpNavigate")}</span>
                    </div>
                  </>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <kbd style={kbdStyle}>ESC</kbd>
                  <span style={hintStyle}>{t("cpPressEsc")}</span>
                </div>
                {results && (
                  <span style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: "var(--text-muted)",
                  }}>
                    {results.total} {t("cpResults")}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const kbdStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 20,
  height: 20,
  padding: "0 4px",
  borderRadius: 4,
  border: "1px solid var(--border)",
  background: "var(--bg-hover)",
  color: "var(--text-muted)",
  fontSize: 10,
  fontWeight: 600,
  fontFamily: "Inter, monospace",
};

const hintStyle = {
  fontSize: 11,
  color: "var(--text-muted)",
};
