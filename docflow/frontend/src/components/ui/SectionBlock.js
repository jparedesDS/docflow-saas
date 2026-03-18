import React from "react";

export default function SectionBlock({ icon: Icon, title, children }) {
  return (
    <div className="rounded-lg" style={{ background: "var(--bg-input)", padding: "12px 14px", marginTop: 12 }}>
      <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
        <Icon size={14} weight="bold" style={{ color: "var(--accent)" }} />
        <span className="text-text-muted" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
