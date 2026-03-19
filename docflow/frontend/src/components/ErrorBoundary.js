import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-page, #0C0D12)",
          color: "var(--text-main, #F1F5F9)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}>
          <div style={{ textAlign: "center", maxWidth: 480, padding: 32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "#DC262620", margin: "0 auto 24px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28,
            }}>
              !
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Algo salió mal
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted, #94A3B8)", marginBottom: 24 }}>
              Ha ocurrido un error inesperado. Intenta recargar la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                border: "none",
                background: "#4F46E5",
                color: "#FFF",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
