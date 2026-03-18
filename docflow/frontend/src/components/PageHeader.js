import React from "react";
import { motion } from "framer-motion";

export default function PageHeader({ title, description, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}
    >
      <div>
        <h1 className="text-text-main" style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.3px" }}>{title}</h1>
        {description && (
          <p className="text-text-muted" style={{ fontSize: 12, marginTop: 3 }}>{description}</p>
        )}
      </div>
      {children && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{children}</div>}
    </motion.div>
  );
}
