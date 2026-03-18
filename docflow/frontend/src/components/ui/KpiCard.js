import React from "react";
import { motion } from "framer-motion";
import AnimatedNumber from "../AnimatedNumber";

export default function KpiCard({ label, value, color, sub, icon: Icon, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-xl overflow-hidden p-5 bg-card border border-border"
    >
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-xl" style={{ background: color }} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 pl-2">
          <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label}
          </p>
          <p className="mt-2 font-mono" style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>
            {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          </p>
          {sub && (
            <p className="mt-1 text-text-muted" style={{ fontSize: 10 }}>{sub}</p>
          )}
        </div>
        {Icon && (
          <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${color}14` }}>
            <Icon size={18} color={color} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
