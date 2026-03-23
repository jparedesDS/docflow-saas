import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FunnelSimple,
  Star,
  Trash,
  Plus,
} from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";

export default function SavedFilters({ entityType, currentFilters, onApplyFilter }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [filters, setFilters] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const containerRef = useRef(null);

  const activeFilter = filters.find((f) => f.is_default);

  const fetchFilters = useCallback(() => {
    api
      .get(`/filters/`, { params: { entity_type: entityType } })
      .then((res) => setFilters(res.data || []))
      .catch(() => setFilters([]));
  }, [entityType]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSaving(false);
        setNewName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleApply = (filter) => {
    onApplyFilter(filter.filters);
    setOpen(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/filters/${id}`);
      setFilters((prev) => prev.filter((f) => f.id !== id));
      showToast(t("filterDeleted") || "Filtro eliminado", "success");
    } catch {
      showToast(t("filterDeleteError") || "Error al eliminar filtro", "error");
    }
  };

  const handleSetDefault = async (e, id) => {
    e.stopPropagation();
    try {
      await api.patch(`/filters/${id}/default`);
      setFilters((prev) =>
        prev.map((f) => ({ ...f, is_default: f.id === id }))
      );
      showToast(t("filterDefaultSet") || "Filtro por defecto actualizado", "success");
    } catch {
      showToast(t("filterDefaultError") || "Error al establecer filtro", "error");
    }
  };

  const handleSave = async () => {
    if (!newName.trim()) return;
    try {
      const res = await api.post("/filters/", {
        name: newName.trim(),
        entity_type: entityType,
        filters: currentFilters,
      });
      setFilters((prev) => [...prev, res.data]);
      setNewName("");
      setSaving(false);
      showToast(t("filterSaved") || "Vista guardada", "success");
    } catch {
      showToast(t("filterSaveError") || "Error al guardar filtro", "error");
    }
  };

  const buttonLabel =
    activeFilter?.name || t("savedFilters") || "Filtros guardados";

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-main)",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
      >
        <FunnelSimple size={14} weight="bold" />
        {buttonLabel}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: 240,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "var(--shadow-dropdown)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {/* Filter list */}
          {filters.length > 0 ? (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {filters.map((filter) => (
                <div
                  key={filter.id}
                  onClick={() => handleApply(filter)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--text-main)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {/* Default star */}
                  <button
                    onClick={(e) => handleSetDefault(e, filter.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      color: filter.is_default ? "#D97706" : "var(--text-muted)",
                    }}
                    title={t("filterSetDefault") || "Establecer como predeterminado"}
                  >
                    <Star
                      size={14}
                      weight={filter.is_default ? "fill" : "regular"}
                    />
                  </button>

                  {/* Name */}
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {filter.name}
                  </span>

                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(e, filter.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 2,
                      display: "flex",
                      color: "var(--text-muted)",
                    }}
                    title={t("delete") || "Eliminar"}
                  >
                    <Trash size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "12px 16px",
                fontSize: 11,
                color: "var(--text-muted)",
                textAlign: "center",
              }}
            >
              {t("noSavedFilters") || "Sin filtros guardados"}
            </div>
          )}

          {/* Separator */}
          <div style={{ height: 1, background: "var(--border)" }} />

          {/* Save current view */}
          {saving ? (
            <div style={{ padding: "8px 12px", display: "flex", gap: 6 }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={t("filterNamePlaceholder") || "Nombre del filtro..."}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: "4px 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#FFF",
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                {t("save") || "Guardar"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSaving(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Plus size={14} weight="bold" />
              {t("saveCurrentView") || "Guardar vista actual"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
