import React from "react";

export default function TopLoadingBar({ loading }) {
  if (!loading) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0,
      height: 3, zIndex: 9999, overflow: "hidden",
      background: "transparent",
    }}>
      <div style={{
        height: "100%",
        background: "var(--accent)",
        animation: "loadingBar 2.5s ease-out forwards",
        borderRadius: "0 2px 2px 0",
        boxShadow: "0 0 8px var(--accent)",
      }} />
    </div>
  );
}
