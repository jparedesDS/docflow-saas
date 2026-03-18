import React, { useRef, useCallback } from "react";
import { motion } from "framer-motion";

export default function SpotlightCard({ children, className = "", style = {} }) {
  const ref = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ref.current.style.setProperty("--x", `${x}px`);
    ref.current.style.setProperty("--y", `${y}px`);
  }, []);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      whileHover={{ scale: 1.008 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`relative overflow-hidden rounded-xl border border-border bg-card ${className}`}
      style={{
        "--x": "50%",
        "--y": "50%",
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: "radial-gradient(200px circle at var(--x) var(--y), rgba(37,99,235,0.06) 0%, transparent 70%)",
        }}
      />
      {children}
    </motion.div>
  );
}
