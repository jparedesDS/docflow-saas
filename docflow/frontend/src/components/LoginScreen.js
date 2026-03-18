import React, { useState } from "react";
import { motion } from "framer-motion";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";

export const ROLES = {
  "Document Controller": {
    color: "#4F46E5",
    initials_fallback: "DC",
    tools: ["comunicaciones", "informes", "configuracion"],
  },
  "Project Manager": {
    color: "#0D9488",
    initials_fallback: "PM",
    tools: ["comunicaciones", "informes"],
  },
  "Comercial": {
    color: "#D97706",
    initials_fallback: "EA",
    tools: [],
  },
};

export const LOGIN_USERS = [
  { username: "jose.paredes",     name: "Jose Paredes",     initials: "JP",  role: "Document Controller" },
  { username: "jesus.martinez",   name: "Jesus Martinez",   initials: "JM",  role: "Project Manager"     },
  { username: "ana.calvo",        name: "Ana Calvo",        initials: "AC",  role: "Comercial"           },
  { username: "ernesto.carrillo", name: "Ernesto Carrillo", initials: "EC",  role: "Comercial"           },
  { username: "luis.bravo",       name: "Luis Bravo",       initials: "LB",  role: "Comercial"           },
  { username: "santos.sanchez",   name: "Santos Sanchez",   initials: "SS",  role: "Comercial"           },
  { username: "jorge.valtierra",  name: "Jorge Valtierra",  initials: "JV",  role: "Comercial"           },
  { username: "carlos.crespo",    name: "Carlos Crespo",    initials: "CCH", role: "Comercial"           },
  { username: "laura.minguez",    name: "Laura Minguez",    initials: "LM",  role: "Comercial"           },
];

function LoginScreen() {
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSelect = (u) => {
    setSelected(u);
    setPassword("");
    setError(false);
  };

  const handleConfirm = async () => {
    if (!selected || !password) return;
    setLoading(true);
    setError(false);
    try {
      const res = await api.post("/auth/login", {
        username: selected.username,
        password,
      });
      localStorage.setItem("docflow_token", res.data.token);
      localStorage.setItem("docflow_user", JSON.stringify(res.data.user));
      window.location.reload();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "var(--bg-page)", padding: 24 }}>

      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#FFF", marginBottom: 4 }}>DocFlow</h1>
        <p style={{ fontSize: 13, color: "#71717A" }}>
          {selected ? t('loginPasswordPrompt') : t('loginSubtitle')}
        </p>
      </div>

      {!selected ? (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12, width: "100%", maxWidth: 520,
        }}>
          {LOGIN_USERS.map(u => {
            const color = ROLES[u.role]?.color || "#3B82F6";
            return (
              <motion.button
                key={u.initials}
                onClick={() => handleSelect(u)}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="card"
                style={{
                  padding: "16px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = color}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  backgroundColor: color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#FFF", fontSize: 13, fontWeight: 700,
                }}>
                  {u.initials}
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#FFF", marginBottom: 2 }}>{u.name}</p>
                  <p style={{ fontSize: 10, color: "#71717A" }}>{u.role}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border" style={{ borderRadius: 16, padding: 28, width: "100%", maxWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              backgroundColor: ROLES[selected.role]?.color || "#3B82F6",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#FFF", fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {selected.initials}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#FFF", marginBottom: 2 }}>{selected.name}</p>
              <p style={{ fontSize: 11, color: "#71717A" }}>{selected.role}</p>
            </div>
          </div>

          <input
            type="password"
            autoFocus
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false); }}
            onKeyDown={e => e.key === "Enter" && handleConfirm()}
            placeholder={t('loginPassword')}
            className="rounded-lg"
            style={{
              width: "100%", padding: "9px 12px",
              border: `1px solid ${error ? "#DC2626" : "var(--border)"}`,
              background: "var(--bg-page)", color: "#FFF", fontSize: 13,
              outline: "none", boxSizing: "border-box", marginBottom: 6,
            }}
          />
          {error && <p style={{ fontSize: 11, color: "#DC2626", marginBottom: 10 }}>{t('loginWrongPassword')}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: error ? 4 : 10 }}>
            <button onClick={() => setSelected(null)}
              className="border border-border rounded-lg"
              style={{ flex: 1, padding: "9px 0", background: "transparent",
                color: "#71717A", fontSize: 13, cursor: "pointer" }}>
              {t('loginBack')}
            </button>
            <button onClick={handleConfirm} disabled={loading}
              className="rounded-lg"
              style={{ flex: 2, padding: "9px 0",
                background: ROLES[selected.role]?.color || "#3B82F6",
                border: "none", color: "#FFF", fontWeight: 700, fontSize: 13,
                cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? t('loginEntering') : t('loginEnter')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginScreen;
