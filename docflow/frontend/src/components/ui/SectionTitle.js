import React from "react";

export default function SectionTitle({ children }) {
  return (
    <h3 className="flex items-center gap-2 mb-4 text-text-muted" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
      <span style={{ width: 3, height: 16, borderRadius: 2, background: "var(--accent)", display: "inline-block", flexShrink: 0 }} />
      {children}
    </h3>
  );
}
