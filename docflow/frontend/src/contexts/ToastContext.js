import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: { bg: "#16A34A18", border: "#16A34A40", color: "#16A34A", icon: "\u2713" },
  error:   { bg: "#DC262618", border: "#DC262640", color: "#DC2626", icon: "\u2717" },
  warning: { bg: "#D9770618", border: "#D9770640", color: "#D97706", icon: "\u26A0" },
  info:    { bg: "#3B82F618", border: "#3B82F640", color: "#3B82F6", icon: "\u2139" },
};

let _toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column-reverse", gap: 8,
        pointerEvents: "none",
      }}>
        <AnimatePresence>
          {toasts.map((toast) => {
            const s = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => removeToast(toast.id)}
                className="bg-card"
                style={{
                  pointerEvents: "auto",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `1px solid ${s.border}`,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                  minWidth: 280,
                  maxWidth: 420,
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: s.bg, color: s.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {s.icon}
                </span>
                <span style={{
                  fontSize: 13, color: "var(--text-main, #FFF)",
                  fontWeight: 500, lineHeight: 1.4,
                }}>
                  {toast.message}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
