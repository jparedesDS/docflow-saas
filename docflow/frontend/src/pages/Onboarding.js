import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Upload, Users, Gear } from "@phosphor-icons/react";
import api from "../services/api";

const STEPS = [
  { key: "welcome", title: "Bienvenido a DocFlow", icon: CheckCircle },
  { key: "invite", title: "Invita a tu equipo", icon: Users },
  { key: "configure", title: "Configuración básica", icon: Gear },
];

function Onboarding({ tenant, onComplete }) {
  const [step, setStep] = useState(0);
  const [invites, setInvites] = useState([{ email: "", role: "Document Controller" }]);
  const [sending, setSending] = useState(false);

  const handleAddInvite = () => {
    setInvites((prev) => [...prev, { email: "", role: "Document Controller" }]);
  };

  const handleInviteChange = (index, field, value) => {
    setInvites((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSendInvites = async () => {
    const valid = invites.filter((i) => i.email.includes("@"));
    if (valid.length === 0) {
      setStep(2);
      return;
    }

    setSending(true);
    try {
      for (const inv of valid) {
        await api.post("/tenants/invite", { email: inv.email, role: inv.role });
      }
    } catch {
      // Continue even if some fail
    } finally {
      setSending(false);
      setStep(2);
    }
  };

  const handleFinish = () => {
    if (onComplete) onComplete();
    else window.location.reload();
  };

  const cardStyle = {
    borderRadius: 16,
    padding: 32,
    width: "100%",
    maxWidth: 520,
  };

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-page)",
    color: "#FFF",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
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
      {/* Step indicators */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 28,
        }}
      >
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: i <= step ? "#4F46E5" : "var(--border)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-card border border-border"
            style={{ ...cardStyle, textAlign: "center" }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle size={32} weight="bold" color="#FFF" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#FFF", marginBottom: 8 }}>
              {tenant?.name || "Tu organización"} está lista
            </h2>
            <p style={{ fontSize: 14, color: "#71717A", lineHeight: 1.5, marginBottom: 28 }}>
              Tu espacio de trabajo ha sido creado. Ahora puedes invitar a tu equipo
              y configurar las integraciones.
            </p>
            <button
              onClick={() => setStep(1)}
              style={{
                padding: "11px 32px",
                background: "#4F46E5",
                border: "none",
                borderRadius: 8,
                color: "#FFF",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Continuar
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="invite"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-card border border-border"
            style={cardStyle}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#FFF", marginBottom: 4 }}>
              Invita a tu equipo
            </h2>
            <p style={{ fontSize: 13, color: "#71717A", marginBottom: 20 }}>
              Envía invitaciones por email. Podrán crear su cuenta al recibirla.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {invites.map((inv, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input
                    type="email"
                    placeholder="email@empresa.com"
                    value={inv.email}
                    onChange={(e) => handleInviteChange(i, "email", e.target.value)}
                    style={{ ...inputStyle, flex: 2 }}
                  />
                  <select
                    value={inv.role}
                    onChange={(e) => handleInviteChange(i, "role", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="Document Controller">Doc Controller</option>
                    <option value="Project Manager">Project Manager</option>
                    <option value="Comercial">Comercial</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddInvite}
              style={{
                background: "transparent",
                border: "1px dashed var(--border)",
                borderRadius: 8,
                padding: "8px 16px",
                color: "#71717A",
                fontSize: 12,
                cursor: "pointer",
                width: "100%",
                marginBottom: 20,
              }}
            >
              + Añadir otro
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "#71717A",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Saltar
              </button>
              <button
                onClick={handleSendInvites}
                disabled={sending}
                style={{
                  flex: 2,
                  padding: "10px 0",
                  background: "#4F46E5",
                  border: "none",
                  borderRadius: 8,
                  color: "#FFF",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: sending ? "wait" : "pointer",
                  opacity: sending ? 0.7 : 1,
                }}
              >
                {sending ? "Enviando..." : "Enviar invitaciones"}
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-card border border-border"
            style={{ ...cardStyle, textAlign: "center" }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#16A34A",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <CheckCircle size={32} weight="bold" color="#FFF" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#FFF", marginBottom: 8 }}>
              Todo listo
            </h2>
            <p style={{ fontSize: 14, color: "#71717A", lineHeight: 1.5, marginBottom: 28 }}>
              Tu espacio de trabajo está configurado. Puedes acceder a todas las
              funcionalidades desde el panel principal.
            </p>
            <button
              onClick={handleFinish}
              style={{
                padding: "11px 40px",
                background: "#4F46E5",
                border: "none",
                borderRadius: 8,
                color: "#FFF",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Ir al dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Onboarding;
