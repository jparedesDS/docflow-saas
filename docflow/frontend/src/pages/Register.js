import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WarningCircle } from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import Onboarding from "./Onboarding";

function Register({ onBack, onRegistered }) {
  const { t } = useI18n();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [registeredData, setRegisteredData] = useState(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    if (field === "name") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50);
      setForm((prev) => ({ ...prev, name: value, slug }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.admin_password !== form.confirm_password) {
      setError(t("registerPasswordMismatch"));
      return;
    }
    if (form.admin_password.length < 6) {
      setError(t("registerPasswordTooShort"));
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/tenants/register", {
        name: form.name,
        slug: form.slug,
        admin_email: form.admin_email,
        admin_password: form.admin_password,
        admin_name: form.admin_name,
      });
      localStorage.setItem("docflow_token", data.token);
      localStorage.setItem("docflow_refresh_token", data.refresh_token);
      localStorage.setItem("docflow_user", JSON.stringify(data.user));
      setRegisteredData(data);
      setShowOnboarding(true);
    } catch (err) {
      setError(err.response?.data?.detail || t("registerError"));
    } finally {
      setLoading(false);
    }
  };

  if (showOnboarding) {
    return (
      <Onboarding
        tenant={registeredData?.tenant}
        onComplete={() => {
          if (onRegistered) onRegistered(registeredData);
          else window.location.reload();
        }}
      />
    );
  }

  return (
    <>
      {/* Background */}
      <div className="login-bg">
        <div className="login-vignette" />
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}>
        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, margin: "0 auto 14px",
            background: "linear-gradient(135deg, var(--accent), #0D9488)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFF", fontSize: 16, fontWeight: 800, letterSpacing: -0.5,
          }}>
            D
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: "var(--text-main)",
            margin: 0, letterSpacing: -0.5,
          }}>
            DocFlow
          </h1>
          <p style={{
            fontSize: 13, color: "var(--text-muted)", marginTop: 6, marginBottom: 0,
          }}>
            {t("registerSubtitle")}
          </p>
          <div style={{
            width: 40, height: 2, borderRadius: 1,
            background: "var(--accent)", margin: "14px auto 0",
            opacity: 0.5,
          }} />
        </div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="login-card"
          style={{
            padding: 28, width: "100%", maxWidth: 420,
            display: "flex", flexDirection: "column", gap: 16,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-sub)",
                marginBottom: 4, display: "block",
              }}>
                {t("registerOrgName")}
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Mi Empresa"
                className="input-field"
                style={{ height: 42, borderRadius: 10 }}
              />
            </div>
            <div>
              <label style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-sub)",
                marginBottom: 4, display: "block",
              }}>
                {t("registerSlug")}
              </label>
              <input
                required
                value={form.slug}
                onChange={(e) => handleChange("slug", e.target.value)}
                placeholder="mi-empresa"
                className="input-field"
                style={{ height: 42, borderRadius: 10 }}
              />
            </div>
          </div>

          <div>
            <label style={{
              fontSize: 12, fontWeight: 600, color: "var(--text-sub)",
              marginBottom: 4, display: "block",
            }}>
              {t("registerYourName")}
            </label>
            <input
              required
              value={form.admin_name}
              onChange={(e) => handleChange("admin_name", e.target.value)}
              placeholder="Juan García"
              className="input-field"
              style={{ height: 42, borderRadius: 10 }}
            />
          </div>

          <div>
            <label style={{
              fontSize: 12, fontWeight: 600, color: "var(--text-sub)",
              marginBottom: 4, display: "block",
            }}>
              {t("registerEmail")}
            </label>
            <input
              type="email"
              required
              value={form.admin_email}
              onChange={(e) => handleChange("admin_email", e.target.value)}
              placeholder="juan@empresa.com"
              className="input-field"
              style={{ height: 42, borderRadius: 10 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-sub)",
                marginBottom: 4, display: "block",
              }}>
                {t("registerPasswordLabel")}
              </label>
              <input
                type="password"
                required
                value={form.admin_password}
                onChange={(e) => handleChange("admin_password", e.target.value)}
                placeholder={t("registerMinChars")}
                className="input-field"
                style={{ height: 42, borderRadius: 10 }}
              />
            </div>
            <div>
              <label style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-sub)",
                marginBottom: 4, display: "block",
              }}>
                {t("registerConfirmPassword")}
              </label>
              <input
                type="password"
                required
                value={form.confirm_password}
                onChange={(e) => handleChange("confirm_password", e.target.value)}
                placeholder={t("registerRepeatPassword")}
                className="input-field"
                style={{ height: 42, borderRadius: 10 }}
              />
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, color: "#DC2626", margin: 0,
                }}
              >
                <WarningCircle size={14} weight="fill" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{
              width: "100%", height: 44, fontSize: 14, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "spin 0.6s linear infinite" }}>
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeDasharray="28" strokeDashoffset="8" opacity="0.8" />
                </svg>
                {t("registerCreating")}
              </>
            ) : t("registerCreate")}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="btn-secondary"
            style={{
              width: "100%", height: 42, fontSize: 13, borderRadius: 10,
            }}
          >
            {t("registerBackToLogin")}
          </button>
        </motion.form>

        {/* Footer */}
        <p style={{
          fontSize: 11, color: "var(--text-muted)", opacity: 0.5,
          marginTop: 40, textAlign: "center",
        }}>
          DocFlow v1.0 &middot; EIPSA 2026
        </p>
      </div>
    </>
  );
}

export default Register;
