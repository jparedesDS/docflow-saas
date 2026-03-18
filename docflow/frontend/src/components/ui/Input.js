import React from "react";

export default function Input({ label, icon: Icon, className = "", ...inputProps }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-text-muted mb-1.5" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        )}
        <input
          className="input-field"
          style={Icon ? { paddingLeft: 30 } : undefined}
          {...inputProps}
        />
      </div>
    </div>
  );
}

export function Textarea({ label, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-text-muted mb-1.5" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </label>
      )}
      <textarea
        className="input-field"
        style={{ resize: "vertical", minHeight: 80 }}
        {...props}
      />
    </div>
  );
}

export function Select({ label, children, className = "", ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-text-muted mb-1.5" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </label>
      )}
      <select className="input-field" {...props}>
        {children}
      </select>
    </div>
  );
}
