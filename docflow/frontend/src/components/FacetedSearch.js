import React, { useState, useMemo } from "react";
import {
  CaretDown,
  CaretRight,
  X,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useI18n } from "../contexts/I18nContext";

const FACET_DEFINITIONS = [
  { key: "Estado", labelKey: "facetStatus", field: "Estado" },
  { key: "Cliente", labelKey: "facetClient", field: "Cliente", limit: 15 },
  { key: "Tipo Doc.", labelKey: "facetDocType", field: "Tipo Doc." },
  { key: "Responsable", labelKey: "facetResponsible", field: "Repsonsable" },
  { key: "Critico", labelKey: "facetCritical", field: "Critico" },
];

function countValues(data, field, limit) {
  const counts = {};
  data.forEach((item) => {
    let val = item[field];
    if (val === undefined || val === null) val = "";
    val = String(val).trim() || "(vac\u00edo)";
    counts[val] = (counts[val] || 0) + 1;
  });

  // Sort by count descending
  let entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (limit) entries = entries.slice(0, limit);
  return entries;
}

function FacetSection({ facet, values, activeValues, onToggle, searchQuery }) {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  const label = t(facet.labelKey) || facet.key;

  // Filter values by search
  const filtered = searchQuery
    ? values.filter(([v]) =>
        v.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : values;

  if (filtered.length === 0 && searchQuery) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "6px 8px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-main)",
          background: "none",
          border: "none",
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {collapsed ? (
          <CaretRight size={11} weight="bold" />
        ) : (
          <CaretDown size={11} weight="bold" />
        )}
        {label}
        <span
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            fontWeight: 400,
            marginLeft: "auto",
          }}
        >
          {filtered.length}
        </span>
      </button>

      {/* Values */}
      {!collapsed && (
        <div style={{ padding: "0 4px 4px 8px" }}>
          {filtered.map(([value, count]) => {
            const isActive = activeValues.includes(value);
            return (
              <label
                key={value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 4px",
                  fontSize: 11,
                  color: "var(--text-main)",
                  cursor: "pointer",
                  borderRadius: 4,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggle(facet.key, value)}
                  style={{
                    width: 13,
                    height: 13,
                    accentColor: "var(--accent)",
                    cursor: "pointer",
                    margin: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {value}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    background: "var(--bg-hover)",
                    padding: "1px 5px",
                    borderRadius: 8,
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {count}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function FacetedSearch({ data, onFilterChange, activeFilters }) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");

  // Compute facet values from data
  const facetData = useMemo(() => {
    if (!data || !data.length) return {};
    const result = {};
    FACET_DEFINITIONS.forEach((facet) => {
      result[facet.key] = countValues(data, facet.field, facet.limit);
    });
    return result;
  }, [data]);

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips = [];
    if (!activeFilters) return chips;
    Object.entries(activeFilters).forEach(([facet, values]) => {
      if (Array.isArray(values)) {
        values.forEach((val) => chips.push({ facet, value: val }));
      }
    });
    return chips;
  }, [activeFilters]);

  const handleToggle = (facetKey, value) => {
    const current = activeFilters?.[facetKey] || [];
    let updated;
    if (current.includes(value)) {
      updated = current.filter((v) => v !== value);
    } else {
      updated = [...current, value];
    }

    const newFilters = { ...activeFilters };
    if (updated.length === 0) {
      delete newFilters[facetKey];
    } else {
      newFilters[facetKey] = updated;
    }
    onFilterChange(newFilters);
  };

  const removeChip = (facetKey, value) => {
    handleToggle(facetKey, value);
  };

  const clearAll = () => {
    onFilterChange({});
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Search within facets */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 8px",
            background: "var(--bg-input)",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        >
          <MagnifyingGlass size={13} color="var(--text-muted)" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchFacets") || "Buscar en filtros..."}
            style={{
              flex: 1,
              fontSize: 11,
              background: "transparent",
              border: "none",
              color: "var(--text-main)",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            padding: "8px 10px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {activeChips.map((chip) => (
            <span
              key={`${chip.facet}-${chip.value}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--accent)",
                background: "var(--accent-soft, rgba(79,70,229,0.07))",
                borderRadius: 12,
                cursor: "pointer",
              }}
              onClick={() => removeChip(chip.facet, chip.value)}
            >
              {chip.value}
              <X size={10} weight="bold" />
            </span>
          ))}
          <button
            onClick={clearAll}
            style={{
              fontSize: 10,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              textDecoration: "underline",
            }}
          >
            {t("clearAll") || "Limpiar todo"}
          </button>
        </div>
      )}

      {/* Facet sections */}
      <div style={{ padding: "4px 2px", maxHeight: 420, overflowY: "auto" }}>
        {FACET_DEFINITIONS.map((facet) => {
          const values = facetData[facet.key] || [];
          if (values.length === 0) return null;
          return (
            <FacetSection
              key={facet.key}
              facet={facet}
              values={values}
              activeValues={activeFilters?.[facet.key] || []}
              onToggle={handleToggle}
              searchQuery={searchQuery}
            />
          );
        })}
      </div>
    </div>
  );
}
