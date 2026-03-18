import React from "react";
import { motion } from "framer-motion";

const VARIANTS = {
  default: "bg-card border border-border rounded-xl",
  elevated: "bg-card border border-border rounded-xl shadow-md",
  ghost: "rounded-xl",
};

const PADDINGS = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

export default function Card({ children, className = "", style = {}, variant = "default", padding = "none", hover = false }) {
  const variantClass = VARIANTS[variant] || VARIANTS.default;
  const paddingClass = PADDINGS[padding] || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`${variantClass} ${paddingClass} ${className}`}
      style={{
        ...style,
        ...(hover ? { cursor: "pointer" } : {}),
      }}
      whileHover={hover ? { y: -2, boxShadow: "var(--shadow-md)" } : undefined}
    >
      {children}
    </motion.div>
  );
}
