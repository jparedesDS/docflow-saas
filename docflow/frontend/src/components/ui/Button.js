import React from "react";
import { motion } from "framer-motion";

const variants = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  const base = variants[variant] || variants.primary;
  const sizeClass = sizes[size] || "";

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`${base} ${sizeClass} inline-flex items-center justify-center gap-1.5 ${className}`}
      disabled={disabled || loading}
      style={{ opacity: disabled || loading ? 0.6 : 1, cursor: disabled || loading ? "default" : "pointer" }}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon size={size === "sm" ? 12 : 14} />
      ) : null}
      {children}
    </motion.button>
  );
}
