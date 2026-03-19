import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./contexts/I18nContext";
import { ToastProvider } from "./contexts/ToastContext";
import { TenantProvider } from "./contexts/TenantContext";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <TenantProvider>
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </TenantProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
