import React from "react";

export default function Input({ label, icon: Icon, className = "", error, helperText, id, ...inputProps }) {
  const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;
  const hasError = !!error;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-text-muted mb-1.5"
          style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        )}
        <input
          id={inputId}
          className="input-field"
          style={{
            ...(Icon ? { paddingLeft: 30 } : {}),
            ...(hasError ? { borderColor: "#DC2626" } : {}),
          }}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError && errorId ? errorId : undefined}
          {...inputProps}
        />
      </div>
      {hasError && error && (
        <p id={errorId} role="alert" style={{ fontSize: 12, color: "#DC2626", margin: "4px 0 0" }}>
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={errorId} style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {helperText}
        </p>
      )}
    </div>
  );
}

export function Textarea({ label, className = "", error, helperText, id, ...props }) {
  const inputId = id || (label ? `textarea-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;
  const hasError = !!error;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-text-muted mb-1.5"
          style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className="input-field"
        style={{
          resize: "vertical",
          minHeight: 80,
          ...(hasError ? { borderColor: "#DC2626" } : {}),
        }}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError && errorId ? errorId : undefined}
        {...props}
      />
      {hasError && error && (
        <p id={errorId} role="alert" style={{ fontSize: 12, color: "#DC2626", margin: "4px 0 0" }}>
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={errorId} style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {helperText}
        </p>
      )}
    </div>
  );
}

export function Select({ label, children, className = "", error, helperText, id, ...props }) {
  const inputId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;
  const hasError = !!error;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-text-muted mb-1.5"
          style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        className="input-field"
        style={hasError ? { borderColor: "#DC2626" } : undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError && errorId ? errorId : undefined}
        {...props}
      >
        {children}
      </select>
      {hasError && error && (
        <p id={errorId} role="alert" style={{ fontSize: 12, color: "#DC2626", margin: "4px 0 0" }}>
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={errorId} style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
