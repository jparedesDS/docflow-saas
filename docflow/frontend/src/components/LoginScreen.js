import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EnvelopeSimple, Lock, Eye, EyeSlash, User, WarningCircle } from "@phosphor-icons/react";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import useForm from "../hooks/useForm";

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
  "admin": {
    color: "#4F46E5",
    initials_fallback: "AD",
    tools: ["comunicaciones", "informes", "configuracion"],
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

/* -- Transition variants -- */
const pageVariants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
};
const pageTransition = { duration: 0.25, ease: [0.16, 1, 0.3, 1] };

/* -- Background -- */
function LoginBackground({ children }) {
  return (
    <>
      <div className="login-bg">
        <div className="login-vignette" />
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </>
  );
}

/* -- Brand header -- */
function BrandHeader({ subtitle }) {
  return (
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
        {subtitle}
      </p>
      <div style={{
        width: 40, height: 2, borderRadius: 1,
        background: "var(--accent)", margin: "14px auto 0",
        opacity: 0.5,
      }} />
    </div>
  );
}

/* -- User card -- */
function UserCard({ user, onClick }) {
  const color = ROLES[user.role]?.color || "#3B82F6";

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onMouseMove={handleMouseMove}
      className="user-card"
      style={{
        padding: "16px 12px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        cursor: "pointer",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}60`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        backgroundColor: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#FFF", fontSize: 13, fontWeight: 700,
        boxShadow: `0 0 0 2px var(--bg-card), 0 0 0 3px ${color}30`,
      }}>
        {user.initials}
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", margin: 0, marginBottom: 4 }}>
          {user.name}
        </p>
        <span style={{
          display: "inline-block", fontSize: 10, fontWeight: 600,
          padding: "2px 8px", borderRadius: 99,
          backgroundColor: `${color}12`, color: color,
        }}>
          {user.role}
        </span>
      </div>
    </motion.button>
  );
}

/* -- Password input -- */
function PasswordInput({ value, onChange, onKeyDown, onBlur, error, showPassword, onToggle, placeholder, shaking }) {
  const { t } = useI18n();
  return (
    <div className={`login-input-wrapper has-toggle ${shaking ? "animate-shake" : ""}`}>
      <Lock size={16} weight="bold" className="login-input-icon" />
      <input
        type={showPassword ? "text" : "password"}
        autoFocus
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className="input-field"
        aria-invalid={!!error || undefined}
        style={{
          height: 44, borderRadius: 10,
          borderColor: error ? "#DC2626" : undefined,
        }}
      />
      <button
        type="button"
        className="login-input-toggle"
        onClick={onToggle}
        tabIndex={-1}
        title={showPassword ? t("loginHidePassword") : t("loginShowPassword")}
      >
        {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/* -- Error message -- */
function ErrorMessage({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, color: "#DC2626", marginTop: 6,
          }}
        >
          <WarningCircle size={14} weight="fill" />
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -- Spinner -- */
function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "spin 0.6s linear infinite" }}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="28" strokeDashoffset="8" opacity="0.8" />
    </svg>
  );
}

/* -- Footer -- */
function LoginFooter() {
  return (
    <p style={{
      fontSize: 11, color: "var(--text-muted)", opacity: 0.5,
      marginTop: 40, textAlign: "center",
    }}>
      DocFlow v1.0 &middot; EIPSA 2026
    </p>
  );
}

/* -- Main component -- */
function LoginScreen({ onShowRegister }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("select");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shaking, setShaking] = useState(false);

  const emailFormFields = useMemo(() => ({
    username: { initial: '', rules: ['required'] },
    password: { initial: '', rules: ['required', { type: 'minLength', value: 6 }] },
  }), []);

  const emailForm = useForm({ fields: emailFormFields });

  const passwordFormFields = useMemo(() => ({
    password: { initial: '', rules: ['required', { type: 'minLength', value: 6 }] },
  }), []);

  const passwordForm = useForm({ fields: passwordFormFields });

  const handleSelect = (u) => {
    setSelected(u);
    passwordForm.reset();
    setError(false);
    setShowPassword(false);
    setMode("password");
  };

  const handleEmailMode = () => {
    setMode("email");
    emailForm.reset();
    setError(false);
    setShowPassword(false);
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const handleConfirm = async () => {
    if (mode === "email") {
      if (!emailForm.validate()) return;
    } else {
      if (!passwordForm.validate()) return;
    }

    const username = mode === "email" ? emailForm.values.username : selected?.username;
    const password = mode === "email" ? emailForm.values.password : passwordForm.values.password;
    if (!username || !password) return;

    setLoading(true);
    setError(false);
    try {
      const res = await api.post("/auth/login", { username, password });
      localStorage.setItem("docflow_token", res.data.token);
      if (res.data.refresh_token) {
        localStorage.setItem("docflow_refresh_token", res.data.refresh_token);
      }
      localStorage.setItem("docflow_user", JSON.stringify(res.data.user));
      window.location.reload();
    } catch {
      setError(true);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setMode("select");
    setError(false);
    setShowPassword(false);
    emailForm.reset();
    passwordForm.reset();
  };

  const selectedColor = selected ? (ROLES[selected.role]?.color || "#3B82F6") : "var(--accent)";

  return (
    <LoginBackground>
      <div style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}>
        <BrandHeader
          subtitle={
            mode === "select" ? t("loginSubtitle") :
            mode === "email" ? t("loginCredentials") :
            t("loginPasswordPrompt")
          }
        />

        <AnimatePresence mode="wait">
          {mode === "select" && (
            <motion.div key="select" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} style={{ width: "100%", maxWidth: 540 }}>
              <div className="login-user-grid">
                {LOGIN_USERS.map(u => (
                  <UserCard key={u.initials} user={u} onClick={() => handleSelect(u)} />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0 16px" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{t("loginOrDivider")}</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <button onClick={handleEmailMode} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", fontSize: 13, borderRadius: 10 }}>
                  <EnvelopeSimple size={16} weight="bold" />
                  {t("loginWithEmail")}
                </button>
                {onShowRegister && (
                  <button onClick={onShowRegister} style={{ background: "transparent", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 0" }}>
                    {t("loginCreateOrg")}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {mode === "password" && (
            <motion.div key="password" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} style={{ width: "100%", maxWidth: 380 }}>
              <div className="login-card" style={{ padding: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%",
                    backgroundColor: selectedColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#FFF", fontSize: 15, fontWeight: 700, flexShrink: 0,
                    boxShadow: `0 0 0 2px var(--bg-card), 0 0 0 3px ${selectedColor}30`,
                  }}>
                    {selected?.initials}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", margin: 0, marginBottom: 4 }}>{selected?.name}</p>
                    <span style={{ display: "inline-block", fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, backgroundColor: `${selectedColor}12`, color: selectedColor }}>{selected?.role}</span>
                  </div>
                </div>

                <PasswordInput
                  value={passwordForm.values.password}
                  onChange={e => { passwordForm.handleChange('password', e.target.value); setError(false); }}
                  onBlur={() => passwordForm.handleBlur('password')}
                  onKeyDown={e => e.key === "Enter" && handleConfirm()}
                  error={error || (passwordForm.touched.password && !!passwordForm.errors.password)}
                  showPassword={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                  placeholder={t("loginPassword")}
                  shaking={shaking}
                />

                <ErrorMessage message={
                  error ? t("loginWrongPassword") :
                  (passwordForm.touched.password && passwordForm.errors.password) || null
                } />

                <div style={{ display: "flex", gap: 8, marginTop: (error || (passwordForm.touched.password && passwordForm.errors.password)) ? 12 : 18 }}>
                  <button onClick={handleBack} className="btn-secondary" style={{ flex: 1, height: 44, fontSize: 13, borderRadius: 10 }}>{t("loginBack")}</button>
                  <button onClick={handleConfirm} disabled={loading || !passwordForm.isValid} className="btn-primary"
                    style={{
                      flex: 2, height: 44, fontSize: 13, borderRadius: 10,
                      background: selectedColor,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: (loading || !passwordForm.isValid) ? 0.7 : 1,
                      cursor: loading ? "wait" : (!passwordForm.isValid ? "not-allowed" : "pointer"),
                    }}>
                    {loading ? <Spinner /> : t("loginEnter")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {mode === "email" && (
            <motion.div key="email" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} style={{ width: "100%", maxWidth: 380 }}>
              <div className="login-card" style={{ padding: 28 }}>
                <div style={{ marginBottom: 12 }}>
                  <div className="login-input-wrapper">
                    <User size={16} weight="bold" className="login-input-icon" />
                    <input
                      type="text"
                      autoFocus
                      value={emailForm.values.username}
                      onChange={e => { emailForm.handleChange('username', e.target.value); setError(false); }}
                      onBlur={() => emailForm.handleBlur('username')}
                      placeholder={t("loginUsername")}
                      className="input-field"
                      aria-invalid={!!(emailForm.touched.username && emailForm.errors.username) || undefined}
                      style={{
                        height: 44, borderRadius: 10,
                        borderColor: (error || (emailForm.touched.username && emailForm.errors.username)) ? "#DC2626" : undefined,
                      }}
                    />
                  </div>
                  {emailForm.touched.username && emailForm.errors.username && (
                    <p role="alert" style={{ fontSize: 12, color: "#DC2626", margin: "4px 0 0" }}>{emailForm.errors.username}</p>
                  )}
                </div>

                <PasswordInput
                  value={emailForm.values.password}
                  onChange={e => { emailForm.handleChange('password', e.target.value); setError(false); }}
                  onBlur={() => emailForm.handleBlur('password')}
                  onKeyDown={e => e.key === "Enter" && handleConfirm()}
                  error={error || (emailForm.touched.password && !!emailForm.errors.password)}
                  showPassword={showPassword}
                  onToggle={() => setShowPassword(p => !p)}
                  placeholder={t("loginPassword")}
                  shaking={shaking}
                />

                {(emailForm.touched.password && emailForm.errors.password) && (
                  <p role="alert" style={{ fontSize: 12, color: "#DC2626", margin: "4px 0 0" }}>{emailForm.errors.password}</p>
                )}

                <ErrorMessage message={error ? t("loginWrongPassword") : null} />

                <div style={{ display: "flex", gap: 8, marginTop: (error || (emailForm.touched.password && emailForm.errors.password)) ? 12 : 18 }}>
                  <button onClick={handleBack} className="btn-secondary" style={{ flex: 1, height: 44, fontSize: 13, borderRadius: 10 }}>{t("loginBack")}</button>
                  <button onClick={handleConfirm} disabled={loading || !emailForm.isValid} className="btn-primary"
                    style={{
                      flex: 2, height: 44, fontSize: 13, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: (loading || !emailForm.isValid) ? 0.7 : 1,
                      cursor: loading ? "wait" : (!emailForm.isValid ? "not-allowed" : "pointer"),
                    }}>
                    {loading ? <Spinner /> : t("loginEnter")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <LoginFooter />
      </div>
    </LoginBackground>
  );
}

export default LoginScreen;
