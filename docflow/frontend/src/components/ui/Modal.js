import React from "react";
import { motion } from "framer-motion";
import { X } from "@phosphor-icons/react";

export default function Modal({ title, onClose, children, maxWidth = 520 }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 bg-card border border-border rounded-xl overflow-y-auto"
        style={{ padding: 24, width: "100%", maxWidth, maxHeight: "90vh", margin: 16 }}
      >
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-text-main" style={{ fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} className="btn-ghost p-1">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
