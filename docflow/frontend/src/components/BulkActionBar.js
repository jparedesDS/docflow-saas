import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  UserSwitch,
  Export,
  X,
} from "@phosphor-icons/react";
import { useI18n } from "../contexts/I18nContext";

const ACTIONS = [
  {
    key: "update_status_approved",
    labelKey: "bulkApprove",
    fallback: "Aprobar",
    color: "#16A34A",
    icon: CheckCircle,
  },
  {
    key: "update_status_rejected",
    labelKey: "bulkReject",
    fallback: "Rechazar",
    color: "#DC2626",
    icon: XCircle,
  },
  {
    key: "assign_responsible",
    labelKey: "bulkReassign",
    fallback: "Reasignar",
    color: "#3B82F6",
    icon: UserSwitch,
  },
  {
    key: "export",
    labelKey: "bulkExport",
    fallback: "Exportar",
    color: "#64748B",
    icon: Export,
  },
];

export default function BulkActionBar({ selectedCount, onAction, onClearSelection }) {
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px",
            background: "rgba(15, 23, 42, 0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 50,
            boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
            zIndex: 1000,
          }}
        >
          {/* Selected count */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#F1F5F9",
              whiteSpace: "nowrap",
              paddingRight: 6,
            }}
          >
            {selectedCount} {t("selected") || "seleccionados"}
          </span>

          {/* Separator */}
          <div
            style={{
              width: 1,
              height: 20,
              background: "rgba(255,255,255,0.15)",
            }}
          />

          {/* Action buttons */}
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => onAction(action.key)}
                title={t(action.labelKey) || action.fallback}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#FFF",
                  background: `${action.color}CC`,
                  border: "none",
                  borderRadius: 20,
                  cursor: "pointer",
                  transition: "background 0.15s, transform 0.1s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = action.color;
                  e.currentTarget.style.transform = "scale(1.04)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${action.color}CC`;
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <Icon size={14} weight="bold" />
                {t(action.labelKey) || action.fallback}
              </button>
            );
          })}

          {/* Separator */}
          <div
            style={{
              width: 1,
              height: 20,
              background: "rgba(255,255,255,0.15)",
            }}
          />

          {/* Clear selection */}
          <button
            onClick={onClearSelection}
            title={t("clearSelection") || "Limpiar selecci\u00f3n"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              background: "rgba(255,255,255,0.1)",
              color: "#94A3B8",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.2)";
              e.currentTarget.style.color = "#FFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.color = "#94A3B8";
            }}
          >
            <X size={14} weight="bold" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
