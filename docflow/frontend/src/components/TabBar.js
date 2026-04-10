import React, { useRef, useCallback } from "react";
import { motion } from "framer-motion";

export default function TabBar({ tabs, active, onChange, layoutId = "tab-indicator" }) {
  const tabListRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    const currentIndex = tabs.findIndex(t => t.key === active);
    let nextIndex = -1;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    }

    if (nextIndex >= 0) {
      onChange(tabs[nextIndex].key);
      // Focus the new tab button
      if (tabListRef.current) {
        const buttons = tabListRef.current.querySelectorAll('[role="tab"]');
        if (buttons[nextIndex]) {
          buttons[nextIndex].focus();
        }
      }
    }
  }, [tabs, active, onChange]);

  return (
    <div
      ref={tabListRef}
      role="tablist"
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--border)",
        position: "relative",
      }}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;

        return (
          <div key={tab.key} style={{ position: "relative" }}>
            <button
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              id={`tab-${layoutId}-${tab.key}`}
              aria-controls={`tabpanel-${layoutId}-${tab.key}`}
              onClick={() => onChange(tab.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                padding: "8px 16px",
                cursor: "pointer",
                border: "none",
                borderRadius: "8px 8px 0 0",
                background: isActive ? "var(--accent-soft)" : "none",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                transition: "color 0.15s, background-color 0.15s",
                position: "relative",
                zIndex: 1,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--text-sub)";
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "var(--text-muted)";
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              {tab.label}
              {tab.count != null && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: "2px 6px",
                    borderRadius: 9999,
                    backgroundColor: isActive ? "var(--accent)" : "var(--bg-hover)",
                    color: isActive ? "#FFF" : "var(--text-muted)",
                    transition: "background-color 0.15s, color 0.15s",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>

            {isActive && (
              <motion.div
                layoutId={layoutId}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2.5,
                  background: "var(--accent)",
                  borderRadius: 2,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
