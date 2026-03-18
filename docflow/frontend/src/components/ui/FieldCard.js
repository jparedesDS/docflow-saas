import React from "react";

export default function FieldCard({ label, value, fullWidth }) {
  return (
    <div
      className="rounded-md"
      style={{
        padding: "6px 10px",
        background: "var(--bg-page)",
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      <span className="text-text-muted block" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span className="text-text-main block" style={{ fontSize: 13, fontWeight: 500, marginTop: 1, lineHeight: 1.35 }}>
        {value}
      </span>
    </div>
  );
}
