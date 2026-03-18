import React from "react";

export default function SkeletonCard({ className = "", style = {} }) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: "linear-gradient(90deg, var(--bg-card) 0%, var(--bg-hover) 50%, var(--bg-card) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s infinite",
        ...style,
      }}
    />
  );
}
