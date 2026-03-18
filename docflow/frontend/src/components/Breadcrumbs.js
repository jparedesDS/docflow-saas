import React from "react";
import { CaretRight } from "@phosphor-icons/react";

/**
 * Breadcrumb navigation.
 * @param {Array} items - [{ label, onClick? }]
 */
export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <CaretRight size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            )}
            {item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 500, color: "var(--text-muted)",
                  padding: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--text-main)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
              >
                {item.label}
              </button>
            ) : (
              <span style={{
                fontSize: 13,
                fontWeight: isLast ? 600 : 500,
                color: isLast ? "var(--text-main)" : "var(--text-muted)",
              }}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
