import React, { useState } from "react";
import { motion } from "framer-motion";
import api from "../services/api";

function Register({ onBack, onRegistered }) {
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
    // Auto-generate slug from name
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
      setError("Las contraseñas no coinciden");
      return;
    }
    if (form.admin_password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
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
      if (onRegistered) onRegistered(data);
      else window.location.reload();
    } catch (err) {
      setError(err.response?.data?.detail || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-page)",
    color: "#FFF",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "#A1A1AA",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-page)",
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#FFF", marginBottom: 4 }}>
          DocFlow
        </h1>
        <p style={{ fontSize: 13, color: "#71717A" }}>Crear nueva organización</p>
      </div>

      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border"
        style={{
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Nombre de la organización</label>
            <input
              required
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Mi Empresa"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Slug (URL)</label>
            <input
              required
              value={form.slug}
              onChange={(e) => handleChange("slug", e.target.value)}
              placeholder="mi-empresa"
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Tu nombre</label>
          <input
            required
            value={form.admin_name}
            onChange={(e) => handleChange("admin_name", e.target.value)}
            placeholder="Juan García"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            required
            value={form.admin_email}
            onChange={(e) => handleChange("admin_email", e.target.value)}
            placeholder="juan@empresa.com"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Contraseña</label>
            <input
              type="password"
              required
              value={form.admin_password}
              onChange={(e) => handleChange("admin_password", e.target.value)}
              placeholder="Min. 6 caracteres"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Confirmar contraseña</label>
            <input
              type="password"
              required
              value={form.confirm_password}
              onChange={(e) => handleChange("confirm_password", e.target.value)}
              placeholder="Repetir contraseña"
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "11px 0",
            background: "#4F46E5",
            border: "none",
            borderRadius: 8,
            color: "#FFF",
            fontWeight: 700,
            fontSize: 14,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creando..." : "Crear organización"}
        </button>

        <button
          type="button"
          onClick={onBack}
          style={{
            width: "100%",
            padding: "9px 0",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "#71717A",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Volver al login
        </button>
      </motion.form>
    </div>
  );
}

export default Register;
