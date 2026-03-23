import React, { useState, useEffect } from "react";
import {
  Eye, EyeSlash, PencilSimple, Trash, Plus, FloppyDisk,
  ArrowClockwise, CheckCircle, XCircle, HardDrives, EnvelopeSimple,
  FileText, Plugs, UserPlus, X, Check, FolderSimple, Clock,
} from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import PageHeader from "../components/PageHeader";
import TabBar from "../components/TabBar";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import { useTenant } from "../contexts/TenantContext";
import api from "../services/api";
import { formatDateTime } from "../utils/dates";

const ALL_TABS = [
  { key: "cuenta", label: "Cuenta", roles: ["admin", "Document Controller", "Project Manager", "Comercial"] },
  { key: "equipo", label: "Equipo", roles: ["admin", "Document Controller", "Project Manager"] },
  { key: "plantillas", label: "Plantillas", roles: ["admin", "Document Controller"] },
  { key: "integraciones", label: "Integraciones", roles: ["admin", "Document Controller"] },
  { key: "webhooks", label: "Webhooks", roles: ["admin", "Document Controller"] },
  { key: "api", label: "API Keys", roles: ["admin"] },
  { key: "sistema", label: "Sistema", roles: ["admin", "Document Controller"] },
  { key: "actividad", label: "Actividad", roles: ["admin", "Document Controller", "Project Manager"] },
  { key: "facturacion", label: "Facturación", roles: ["admin", "Document Controller"] },
  { key: "sincronizacion", label: "Sincronizacion", roles: ["admin", "Document Controller"] },
];

/* ── Card wrapper ── */
function SettingsCard({ children, style }) {
  return (
    <div className="card" style={{ padding: 20, ...style }}>
      {children}
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h3 className="text-text-main" style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
      {children}
    </h3>
  );
}

/* ------------------------------------------------------------------ */
/*  General tab: theme, language, change password                      */
/* ------------------------------------------------------------------ */
function GeneralTab() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const { showToast } = useToast();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  // Email IMAP settings
  const [emailCfg, setEmailCfg] = useState({ email: "", password: "" });
  const [hasImapPassword, setHasImapPassword] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // null | "loading" | "saved" | "error" | "testOk" | "testFail"

  useEffect(() => {
    api.get("/auth/me/email-settings").then(res => {
      setEmailCfg(prev => ({ ...prev, email: res.data.imap_email || "" }));
      setHasImapPassword(res.data.has_password);
    }).catch(() => {});
  }, []);

  const saveEmailSettings = async () => {
    if (!emailCfg.email || !emailCfg.password) return;
    setEmailStatus("loading");
    try {
      await api.put("/auth/me/email-settings", {
        imap_email: emailCfg.email,
        imap_password: emailCfg.password,
      });
      setEmailStatus("saved");
      setHasImapPassword(true);
      showToast(t("emailSaved"), "success");
    } catch {
      setEmailStatus("error");
      showToast(t("emailTestFail"), "error");
    }
  };

  const testEmailConnection = async () => {
    if (!emailCfg.email || !emailCfg.password) return;
    setEmailStatus("loading");
    try {
      await api.post("/auth/me/test-email", {
        imap_email: emailCfg.email,
        imap_password: emailCfg.password,
      });
      setEmailStatus("testOk");
      showToast(t("emailTestOk"), "success");
    } catch {
      setEmailStatus("testFail");
      showToast(t("emailTestFail"), "error");
    }
  };

  const changePassword = async () => {
    if (!pw.current || !pw.next) return;
    if (pw.next !== pw.confirm) {
      showToast("Las contraseñas no coinciden", "error");
      return;
    }
    if (pw.next.length < 6) {
      showToast("La contraseña debe tener al menos 6 caracteres", "error");
      return;
    }
    setSaving(true);
    try {
      await api.post("/auth/change-password", {
        current_password: pw.current,
        new_password: pw.next,
      });
      showToast("Contraseña actualizada correctamente", "success");
      setPw({ current: "", next: "", confirm: "" });
    } catch (e) {
      showToast(e.response?.data?.detail || "Error al cambiar contraseña", "error");
    }
    setSaving(false);
  };

  const ToggleRow = ({ label, desc, onClick, value }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{label}</p>
        <p className="text-text-muted" style={{ fontSize: 11 }}>{desc}</p>
      </div>
      <button onClick={onClick} className="rounded-lg border border-border"
        style={{ padding: "6px 16px", background: "var(--bg-hover)", color: "var(--text-main)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {value}
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard>
        <SectionHeading>Apariencia</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ToggleRow label="Tema" desc="Cambiar entre modo claro y oscuro" onClick={toggleTheme} value={theme === "dark" ? "Oscuro" : "Claro"} />
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <ToggleRow label="Idioma" desc="Cambiar idioma de la interfaz" onClick={toggleLang} value={lang === "es" ? "Español" : "English"} />
          </div>
        </div>
      </SettingsCard>

      <SettingsCard>
        <SectionHeading>Seguridad</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
          <div>
            <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Contraseña actual</label>
            <div style={{ position: "relative" }}>
              <input type={showPw ? "text" : "password"} value={pw.current}
                onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
                className="input-field" style={{ width: "100%", paddingRight: 36 }} />
              <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                {showPw ? <EyeSlash size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Nueva contraseña</label>
            <input type={showPw ? "text" : "password"} value={pw.next}
              onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
              className="input-field" style={{ width: "100%" }} />
          </div>
          <div>
            <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>Confirmar contraseña</label>
            <input type={showPw ? "text" : "password"} value={pw.confirm}
              onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              className="input-field" style={{ width: "100%" }} />
          </div>
          <button onClick={changePassword} disabled={saving || !pw.current || !pw.next}
            className="rounded-lg" style={{
              padding: "8px 20px", border: "none", width: "fit-content",
              background: "var(--accent)", color: "#FFF", fontSize: 13, fontWeight: 600,
              cursor: saving ? "wait" : "pointer", opacity: (saving || !pw.current || !pw.next) ? 0.5 : 1,
            }}>
            {saving ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <SectionHeading>{t("emailImapTitle")}</SectionHeading>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
            background: hasImapPassword ? "rgba(22,163,74,0.12)" : "rgba(100,116,139,0.12)",
            color: hasImapPassword ? "#16A34A" : "var(--text-muted)",
          }}>
            {hasImapPassword ? t("emailConfigured") : t("emailNotLinked")}
          </span>
        </div>
        <p className="text-text-muted" style={{ fontSize: 12, marginBottom: 14, marginTop: -8 }}>{t("emailImapDesc")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
          <div>
            <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{t("emailImapEmail")}</label>
            <input type="email" value={emailCfg.email}
              onChange={e => setEmailCfg(p => ({ ...p, email: e.target.value }))}
              className="input-field" style={{ width: "100%" }}
              placeholder="usuario@eipsa.es" />
          </div>
          <div>
            <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{t("emailImapPassword")}</label>
            <input type="password" value={emailCfg.password}
              onChange={e => setEmailCfg(p => ({ ...p, password: e.target.value }))}
              className="input-field" style={{ width: "100%" }}
              placeholder={hasImapPassword ? "********" : ""} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveEmailSettings} disabled={emailStatus === "loading" || !emailCfg.email || !emailCfg.password}
              className="rounded-lg" style={{
                padding: "8px 20px", border: "none",
                background: "var(--accent)", color: "#FFF", fontSize: 13, fontWeight: 600,
                cursor: emailStatus === "loading" ? "wait" : "pointer",
                opacity: (emailStatus === "loading" || !emailCfg.email || !emailCfg.password) ? 0.5 : 1,
              }}>
              {emailStatus === "loading" ? "..." : t("emailSave")}
            </button>
            <button onClick={testEmailConnection} disabled={emailStatus === "loading" || !emailCfg.email || !emailCfg.password}
              className="rounded-lg border border-border" style={{
                padding: "8px 16px", background: "var(--bg-hover)",
                color: "var(--text-main)", fontSize: 13, fontWeight: 600,
                cursor: emailStatus === "loading" ? "wait" : "pointer",
                opacity: (emailStatus === "loading" || !emailCfg.email || !emailCfg.password) ? 0.5 : 1,
              }}>
              {t("emailTest")}
            </button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Equipo tab: team members + invitations + management               */
/* ------------------------------------------------------------------ */
function EquipoTab({ readOnly, user }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const tenant = useTenant();

  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Document Controller");
  const [inviting, setInviting] = useState(false);

  const isAdmin = user?.role === "Document Controller" || user?.role === "admin";

  const ROLE_COLORS = {
    "Document Controller": "#4F46E5",
    "Project Manager": "#0D9488",
    Comercial: "#D97706",
    admin: "#DC2626",
  };

  const AVAILABLE_ROLES = ["Document Controller", "Project Manager", "Comercial"];

  const loadData = () => {
    setLoading(true);
    Promise.allSettled([
      api.get("/auth/users"),
      api.get("/tenants/invitations"),
    ]).then(([usersRes, invRes]) => {
      setUsers(usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
      setInvitations(invRes.status === "fulfilled" && Array.isArray(invRes.value.data) ? invRes.value.data : []);
    }).finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.put(`/auth/users/${userId}`, { role: newRole });
      showToast(t("teamRoleUpdated"), "success");
      loadData();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error", "error");
    }
  };

  const handleToggleActive = async (u) => {
    const newActive = !u.is_active;
    if (!newActive && !window.confirm(t("teamConfirmDeactivate"))) return;
    try {
      await api.put(`/auth/users/${u.id}`, { is_active: newActive });
      showToast(newActive ? t("teamUserActivated") : t("teamUserDeactivated"), "success");
      loadData();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error", "error");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    const activeUsers = users.filter(u => u.is_active).length;
    if (!tenant.isWithinLimit("users", activeUsers + invitations.length)) {
      showToast(t("teamQuotaExceeded"), "error");
      return;
    }
    setInviting(true);
    try {
      await api.post("/tenants/invite", { email: inviteEmail, role: inviteRole });
      showToast(t("teamInviteSent"), "success");
      setShowInviteModal(false);
      setInviteEmail("");
      loadData();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error", "error");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (invId) => {
    try {
      await api.delete(`/tenants/invitations/${invId}`);
      showToast(t("teamInviteCancelled"), "success");
      loadData();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error", "error");
    }
  };

  if (loading)
    return <div className="text-text-muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>{t("loading")}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <SectionHeading>{t("teamTitle")}</SectionHeading>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {readOnly && <span className="text-text-muted" style={{ fontSize: 11 }}>{t("teamReadOnly")}</span>}
            {isAdmin && !readOnly && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="rounded-lg"
                style={{
                  padding: "6px 14px", border: "none", background: "var(--accent)", color: "#FFF",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <UserPlus size={14} weight="bold" /> {t("teamInviteMember")}
              </button>
            )}
          </div>
        </div>

        {/* Users list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map(u => (
            <div key={u.username} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8,
              border: "1px solid var(--border)", opacity: u.is_active === false ? 0.5 : 1,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: ROLE_COLORS[u.role] || "#71717A",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#FFF", fontSize: 12, fontWeight: 700,
              }}>
                {u.initials || u.username.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>
                  {u.name || u.username}
                  {u.is_active === false && (
                    <span style={{ fontSize: 10, color: "#DC2626", marginLeft: 8, fontWeight: 700 }}>
                      {t("teamInactive")}
                    </span>
                  )}
                </p>
                <p className="text-text-muted" style={{ fontSize: 11 }}>{u.username}</p>
              </div>

              {isAdmin && !readOnly && (u.id || u.username) ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <select
                    value={u.role}
                    onChange={(e) => handleChangeRole(u.id || u.username, e.target.value)}
                    className="input-field"
                    style={{ fontSize: 10, padding: "2px 4px", minWidth: 100 }}
                  >
                    {AVAILABLE_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    {user?.role === "admin" && <option value="admin">admin</option>}
                  </select>
                  {u.id && u.username !== user?.username && (
                    <button
                      onClick={() => handleToggleActive(u)}
                      style={{
                        background: "none", border: "1px solid var(--border)", borderRadius: 4,
                        padding: "2px 8px", fontSize: 10, cursor: "pointer",
                        color: u.is_active === false ? "#16A34A" : "#DC2626",
                      }}
                    >
                      {u.is_active === false ? t("teamActivate") : t("teamDeactivate")}
                    </button>
                  )}
                </div>
              ) : (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                  background: (ROLE_COLORS[u.role] || "#71717A") + "20",
                  color: ROLE_COLORS[u.role] || "#71717A",
                }}>
                  {u.role}
                </span>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Pending invitations */}
      {isAdmin && !readOnly && invitations.length > 0 && (
        <SettingsCard>
          <SectionHeading>{t("teamPendingInvitations")}</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invitations.map(inv => {
              const daysLeft = inv.expires_at
                ? Math.max(0, Math.ceil((new Date(inv.expires_at) - new Date()) / 86400000))
                : 0;
              return (
                <div key={inv.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                  borderRadius: 8, border: "1px solid var(--border)",
                }}>
                  <div style={{ flex: 1 }}>
                    <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{inv.email}</p>
                    <p className="text-text-muted" style={{ fontSize: 11 }}>
                      {t("teamExpiresIn")} {daysLeft} {t("teamDays")}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: (ROLE_COLORS[inv.role] || "#71717A") + "20",
                    color: ROLE_COLORS[inv.role] || "#71717A",
                  }}>
                    {inv.role}
                  </span>
                  <button
                    onClick={() => handleCancelInvite(inv.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}
                    title={t("teamCancelInvite")}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </SettingsCard>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.4)",
        }} onClick={() => setShowInviteModal(false)}>
          <div
            className="bg-card border border-border"
            style={{ borderRadius: 12, padding: 24, width: 400, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700 }}>{t("teamInviteTitle")}</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="text-text-muted" style={labelStyle}>{t("teamInviteEmail")}</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="input-field"
                  style={{ width: "100%" }}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="text-text-muted" style={labelStyle}>{t("teamInviteRole")}</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="input-field"
                  style={{ width: "100%" }}
                >
                  {AVAILABLE_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail || inviting}
                className="rounded-lg"
                style={{
                  padding: "10px 20px", border: "none", background: "var(--accent)", color: "#FFF",
                  fontSize: 13, fontWeight: 600, cursor: inviting ? "wait" : "pointer",
                  opacity: (!inviteEmail || inviting) ? 0.5 : 1,
                }}
              >
                {inviting ? t("teamInviteSending") : t("teamInviteSend")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Plantillas tab: full CRUD                                          */
/* ------------------------------------------------------------------ */
function PlantillasTab() {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // template object or "new"
  const [form, setForm] = useState({ nombre: "", tipo: "claim", asunto: "", cuerpo_html: "", variables: "" });
  const [preview, setPreview] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/templates/").then(r => setTemplates(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const TIPO_COLORS = { claim: "#DB2777", transmittal: "#3B82F6", alerta: "#D97706" };

  const startNew = () => {
    setEditing("new");
    setForm({ nombre: "", tipo: "claim", asunto: "", cuerpo_html: "", variables: "" });
    setPreview(null);
  };

  const startEdit = (t) => {
    setEditing(t);
    setForm({
      nombre: t.nombre,
      tipo: t.tipo,
      asunto: t.asunto,
      cuerpo_html: t.cuerpo_html,
      variables: (t.variables || []).join(", "),
    });
    setPreview(null);
  };

  const handleSave = async () => {
    const body = {
      nombre: form.nombre,
      tipo: form.tipo,
      asunto: form.asunto,
      cuerpo_html: form.cuerpo_html,
      variables: form.variables.split(",").map(v => v.trim()).filter(Boolean),
    };
    try {
      if (editing === "new") {
        await api.post("/templates/", body);
        showToast("Plantilla creada", "success");
      } else {
        await api.put(`/templates/${editing.id}`, body);
        showToast("Plantilla actualizada", "success");
      }
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error al guardar", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta plantilla?")) return;
    try {
      await api.delete(`/templates/${id}`);
      showToast("Plantilla eliminada", "success");
      load();
    } catch {
      showToast("Error al eliminar", "error");
    }
  };

  const handlePreview = async () => {
    if (!editing || editing === "new") return;
    const vars = {};
    (form.variables || "").split(",").map(v => v.trim()).filter(Boolean).forEach(v => { vars[v] = `[${v}]`; });
    try {
      const res = await api.post(`/templates/${editing.id}/preview`, vars);
      setPreview(res.data);
    } catch {
      showToast("Error al generar preview", "error");
    }
  };

  if (loading) return <div className="text-text-muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>Cargando plantillas...</div>;

  if (editing) {
    return (
      <SettingsCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <SectionHeading>{editing === "new" ? "Nueva plantilla" : `Editar: ${editing.nombre}`}</SectionHeading>
          <button onClick={() => setEditing(null)} className="text-text-muted" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
            Cancelar
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 600 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="text-text-muted" style={labelStyle}>Nombre</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="input-field" style={{ width: "100%" }} />
            </div>
            <div>
              <label className="text-text-muted" style={labelStyle}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className="input-field" style={{ width: "100%" }}>
                <option value="claim">Reclamación</option>
                <option value="transmittal">Transmittal</option>
                <option value="alerta">Alerta</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-text-muted" style={labelStyle}>Asunto</label>
            <input value={form.asunto} onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))} className="input-field" style={{ width: "100%" }} />
          </div>
          <div>
            <label className="text-text-muted" style={labelStyle}>Cuerpo HTML</label>
            <textarea value={form.cuerpo_html} onChange={e => setForm(f => ({ ...f, cuerpo_html: e.target.value }))}
              className="input-field" rows={8} style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }} />
          </div>
          <div>
            <label className="text-text-muted" style={labelStyle}>Variables (separadas por coma)</label>
            <input value={form.variables} onChange={e => setForm(f => ({ ...f, variables: e.target.value }))}
              className="input-field" style={{ width: "100%" }} placeholder="pedido, cliente, documento" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={!form.nombre || !form.asunto}
              className="rounded-lg" style={{
                padding: "8px 20px", border: "none", background: "var(--accent)", color: "#FFF",
                fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                opacity: (!form.nombre || !form.asunto) ? 0.5 : 1,
              }}>
              <FloppyDisk size={14} /> Guardar
            </button>
            {editing !== "new" && (
              <button onClick={handlePreview} className="rounded-lg border border-border text-text-sub" style={{
                padding: "8px 20px", background: "var(--bg-hover)", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>
                Vista previa
              </button>
            )}
          </div>
          {preview && (
            <div style={{ marginTop: 8 }}>
              <label className="text-text-muted" style={labelStyle}>Preview</label>
              <div className="border border-border rounded-lg" style={{ padding: 16, background: "var(--bg-page)" }}>
                <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{preview.asunto}</p>
                <div style={{ fontSize: 12 }} dangerouslySetInnerHTML={{ __html: preview.cuerpo_html }} />
              </div>
            </div>
          )}
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>Plantillas de Email</SectionHeading>
        <button onClick={startNew} className="rounded-lg" style={{
          padding: "6px 14px", border: "none", background: "var(--accent)", color: "#FFF",
          fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          <Plus size={12} weight="bold" /> Nueva
        </button>
      </div>
      {templates.length === 0 ? (
        <div className="text-text-muted" style={{ padding: 40, textAlign: "center" }}>
          <FileText size={32} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
          <p style={{ fontSize: 13 }}>No hay plantillas creadas</p>
          <p style={{ fontSize: 11 }}>Crea una plantilla para automatizar emails</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {templates.map(t => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{t.nombre}</p>
                <p className="text-text-muted" style={{ fontSize: 11 }}>{t.asunto}</p>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                background: (TIPO_COLORS[t.tipo] || "#71717A") + "18",
                color: TIPO_COLORS[t.tipo] || "#71717A",
                textTransform: "uppercase",
              }}>
                {t.tipo}
              </span>
              {t.variables?.length > 0 && (
                <span className="text-text-muted" style={{ fontSize: 10 }}>
                  {t.variables.length} var{t.variables.length > 1 ? "s" : ""}
                </span>
              )}
              <button onClick={() => startEdit(t)} className="text-text-muted" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <PencilSimple size={14} />
              </button>
              <button onClick={() => handleDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Response Templates section */}
      <ResponseTemplatesSection />
    </SettingsCard>
  );
}

/* ── Response Templates management ── */
function ResponseTemplatesSection() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", platform: "ALL", subject: "", body_html: "", variables: "" });
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    api.get("/response-templates/").then(r => setTemplates(r.data || [])).catch(() => {});
  };
  useEffect(load, []);

  const PLATFORM_OPTS = ["ALL", "TR", "GAIA", "ACONEX", "SENDOC"];

  const startEdit = (tmpl) => {
    setEditingId(tmpl.id);
    setForm({
      name: tmpl.name,
      platform: tmpl.platform,
      subject: tmpl.subject,
      body_html: tmpl.body_html,
      variables: (tmpl.variables || []).join(", "),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const body = {
      name: form.name,
      platform: form.platform,
      subject: form.subject,
      body_html: form.body_html,
      variables: form.variables.split(",").map(v => v.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await api.put(`/response-templates/${editingId}`, body);
      } else {
        await api.post("/response-templates/", body);
      }
      showToast(t("rtSaved"), "success");
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", platform: "ALL", subject: "", body_html: "", variables: "" });
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("rtDeleteTemplate") + "?")) return;
    try {
      await api.delete(`/response-templates/${id}`);
      showToast(t("rtDeleted"), "success");
      load();
    } catch {}
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionHeading>{t("rtTemplates")}</SectionHeading>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", platform: "ALL", subject: "", body_html: "", variables: "" }); }}
          className="rounded-lg"
          style={{
            padding: "6px 14px", border: "none", cursor: "pointer",
            background: "var(--accent)", color: "#FFF",
            fontSize: 12, fontWeight: 600,
          }}
        >
          {showForm ? t("cancel") : t("rtNewTemplate")}
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-lg" style={{ padding: 16, marginBottom: 16, background: "var(--bg-page)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
              <div>
                <label className="text-text-muted" style={labelStyle}>{t("rtTemplateName")}</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="input-field" style={{ width: "100%" }} />
              </div>
              <div>
                <label className="text-text-muted" style={labelStyle}>{t("rtPlatform")}</label>
                <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))}
                  className="input-field" style={{ width: "100%" }}>
                  {PLATFORM_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-text-muted" style={labelStyle}>{t("rtSubject")}</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                className="input-field" style={{ width: "100%" }} placeholder="RE: {transmittal_ref} - ..." />
            </div>
            <div>
              <label className="text-text-muted" style={labelStyle}>{t("rtBody")}</label>
              <textarea value={form.body_html} onChange={e => setForm(p => ({ ...p, body_html: e.target.value }))}
                className="input-field" style={{ width: "100%", minHeight: 100, fontFamily: "monospace", fontSize: 11 }} />
            </div>
            <div>
              <label className="text-text-muted" style={labelStyle}>{t("rtVariables")}</label>
              <input value={form.variables} onChange={e => setForm(p => ({ ...p, variables: e.target.value }))}
                className="input-field" style={{ width: "100%" }}
                placeholder="transmittal_ref, pedido, docs_list, fecha" />
            </div>
            <button onClick={handleSave} disabled={!form.name || !form.subject}
              className="rounded-lg" style={{
                padding: "8px 20px", border: "none", width: "fit-content",
                background: "var(--accent)", color: "#FFF", fontSize: 13, fontWeight: 600,
                cursor: "pointer", opacity: (!form.name || !form.subject) ? 0.5 : 1,
              }}>
              {t("save")}
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-text-muted" style={{ fontSize: 12, textAlign: "center", padding: 16 }}>{t("rtNoTemplates")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {templates.map(tmpl => (
            <div key={tmpl.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0", borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{tmpl.name}</span>
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "1px 6px",
                  borderRadius: 4, background: "var(--bg-hover)", color: "var(--text-muted)",
                }}>
                  {tmpl.platform}
                </span>
                <p className="text-text-muted" style={{ fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tmpl.subject}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => startEdit(tmpl)}
                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid var(--border)", background: "transparent", color: "var(--text-main)", cursor: "pointer" }}>
                  <PencilSimple size={12} />
                </button>
                <button onClick={() => handleDelete(tmpl.id)}
                  style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "1px solid #DC262640", background: "transparent", color: "#DC2626", cursor: "pointer" }}>
                  <Trash size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 };

/* ------------------------------------------------------------------ */
/*  Integraciones tab: connection status                               */
/* ------------------------------------------------------------------ */
function IntegracionesTab() {
  const [polling, setPolling] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get("/polling/status").then(r => setPolling(r.data)).catch(() => {});
    api.get("/health/").then(r => setHealth(r.data)).catch(() => {});
  }, []);

  const StatusDot = ({ ok }) => (
    <span style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: ok ? "#16A34A" : "#DC2626",
      display: "inline-block",
    }} />
  );

  const IntegrationCard = ({ icon: Icon, title, children }) => (
    <div style={{
      padding: 16, borderRadius: 10, border: "1px solid var(--border)",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Icon size={16} style={{ color: "var(--accent)" }} />
        <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
      </div>
      {children}
    </div>
  );

  const InfoRow = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span className="text-text-muted">{label}</span>
      <span className="text-text-main" style={{ fontWeight: 600 }}>{value || "—"}</span>
    </div>
  );

  return (
    <SettingsCard>
      <SectionHeading>Estado de Integraciones</SectionHeading>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <IntegrationCard icon={EnvelopeSimple} title="IMAP / SMTP">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot ok={!!polling} />
            <span className="text-text-sub" style={{ fontSize: 12 }}>{polling ? "Conectado" : "Sin datos"}</span>
          </div>
          <InfoRow label="Último polling" value={polling?.last_run || "Nunca"} />
          <InfoRow label="Emails encontrados" value={polling?.emails_found ?? "—"} />
          {polling?.error && (
            <p style={{ fontSize: 11, color: "#DC2626" }}>Error: {polling.error}</p>
          )}
        </IntegrationCard>

        <IntegrationCard icon={Plugs} title="DocuSign">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot ok={false} />
            <span className="text-text-sub" style={{ fontSize: 12 }}>No configurado</span>
          </div>
          <InfoRow label="Estado" value="Pendiente de configuración" />
        </IntegrationCard>

        <IntegrationCard icon={HardDrives} title="ERP (Excel)">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot ok={health?.status === "ok"} />
            <span className="text-text-sub" style={{ fontSize: 12 }}>{health?.status === "ok" ? "Archivos disponibles" : "Sin datos"}</span>
          </div>
          {health?.excel_files && Object.entries(health.excel_files).map(([name, info]) => (
            <InfoRow key={name} label={name} value={info.exists ? `${(info.size_mb || 0).toFixed(1)} MB` : "No encontrado"} />
          ))}
        </IntegrationCard>
      </div>

      {/* Client Portal Management */}
      <PortalAccessSection />
    </SettingsCard>
  );
}

/* ── Portal Access management section ── */
function PortalAccessSection() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [accesses, setAccesses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [expiresDays, setExpiresDays] = useState(90);
  const [generatedLink, setGeneratedLink] = useState("");
  const [creating, setCreating] = useState(false);

  const loadAccesses = () => {
    api.get("/portal/access").then(r => setAccesses(r.data || [])).catch(() => {});
  };

  useEffect(loadAccesses, []);

  const handleGenerate = async () => {
    if (!clientName || !contactEmail) return;
    setCreating(true);
    try {
      const res = await api.post("/portal/access", {
        client_name: clientName,
        contact_email: contactEmail,
        expires_days: expiresDays,
      });
      const token = res.data.token;
      const link = `${window.location.origin}?portal_token=${token}`;
      setGeneratedLink(link);
      showToast(t("portalLinkGenerated"), "success");
      loadAccesses();
      setClientName("");
      setContactEmail("");
    } catch (e) {
      showToast(e.response?.data?.detail || "Error", "error");
    }
    setCreating(false);
  };

  const handleRevoke = async (id) => {
    if (!window.confirm(t("portalRevokeConfirm"))) return;
    try {
      await api.delete(`/portal/access/${id}`);
      showToast(t("portalAccessRevoked"), "success");
      loadAccesses();
    } catch {}
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionHeading>{t("portalTitle")}</SectionHeading>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg"
          style={{
            padding: "6px 14px", border: "none", cursor: "pointer",
            background: "var(--accent)", color: "#FFF",
            fontSize: 12, fontWeight: 600,
          }}
        >
          {showForm ? t("cancel") : t("portalGenerateLink")}
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-lg" style={{ padding: 16, marginBottom: 16, background: "var(--bg-page)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 12 }}>
            <div>
              <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{t("portalClientName")}</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)}
                className="input-field" style={{ width: "100%" }} placeholder="Aramco, Repsol..." />
            </div>
            <div>
              <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{t("portalContactEmail")}</label>
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                className="input-field" style={{ width: "100%" }} placeholder="email@client.com" />
            </div>
            <div>
              <label className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, display: "block", marginBottom: 4 }}>{t("portalExpiresDays")}</label>
              <input type="number" value={expiresDays} onChange={e => setExpiresDays(Number(e.target.value))}
                className="input-field" style={{ width: "100%" }} min={7} max={365} />
            </div>
          </div>
          <button onClick={handleGenerate} disabled={creating || !clientName || !contactEmail}
            className="rounded-lg" style={{
              marginTop: 12, padding: "8px 20px", border: "none", cursor: "pointer",
              background: "var(--accent)", color: "#FFF", fontSize: 13, fontWeight: 600,
              opacity: (creating || !clientName || !contactEmail) ? 0.5 : 1,
            }}>
            {creating ? "..." : t("portalGenerateLink")}
          </button>
          {generatedLink && (
            <div style={{ marginTop: 12, padding: 12, background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 8 }}>
              <p className="text-text-main" style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Enlace generado:</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={generatedLink} readOnly className="input-field" style={{ flex: 1, fontSize: 11 }} />
                <button
                  onClick={() => { navigator.clipboard.writeText(generatedLink); showToast(t("portalCopyLink"), "success"); }}
                  className="rounded-lg border border-border"
                  style={{ padding: "6px 12px", background: "var(--bg-hover)", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--text-main)" }}
                >
                  {t("portalCopyLink")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {accesses.length === 0 ? (
        <p className="text-text-muted" style={{ fontSize: 12, textAlign: "center", padding: 16 }}>{t("portalNoAccess")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {accesses.map(a => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0", borderBottom: "1px solid var(--border)",
            }}>
              <div>
                <span className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{a.client_name}</span>
                <span className="text-text-muted" style={{ fontSize: 11, marginLeft: 8 }}>{a.contact_email}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="text-text-muted" style={{ fontSize: 10 }}>
                  {a.expires_at ? `Expira: ${a.expires_at.split("T")[0]}` : ""}
                </span>
                <button
                  onClick={() => handleRevoke(a.id)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                    border: "1px solid #DC262640", background: "transparent", color: "#DC2626", cursor: "pointer",
                  }}
                >
                  {t("portalRevoke")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sistema tab: health + polling + backup + disk                      */
/* ------------------------------------------------------------------ */
function SistemaTab() {
  const { showToast } = useToast();
  const [health, setHealth] = useState(null);
  const [polling, setPolling] = useState(null);
  const [backup, setBackup] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [pollingLoading, setPollingLoading] = useState(false);

  const loadAll = () => {
    api.get("/health/").then(r => setHealth(r.data)).catch(() => {});
    api.get("/polling/status").then(r => setPolling(r.data)).catch(() => {});
    api.get("/backup/status").then(r => setBackup(r.data)).catch(() => setBackup(null));
  };

  useEffect(loadAll, []);

  const triggerBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.post("/backup/trigger");
      showToast(res.data?.message || "Backup completado", "success");
      loadAll();
    } catch {
      showToast("Error al ejecutar backup", "error");
    }
    setBackupLoading(false);
  };

  const triggerPolling = async () => {
    setPollingLoading(true);
    try {
      await api.post("/polling/trigger");
      showToast("Polling ejecutado", "success");
      loadAll();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error al ejecutar polling", "error");
    }
    setPollingLoading(false);
  };

  const StatusRow = ({ label, value, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      <span className="text-text-muted">{label}</span>
      <span style={{ fontWeight: 600, color: color || "var(--text-main)" }}>{value}</span>
    </div>
  );

  const diskUsed = health?.disk?.used_pct ?? health?.used_pct;
  const diskFree = health?.disk?.free_gb ?? health?.free_gb;
  const diskTotal = health?.disk?.total_gb ?? health?.total_gb;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Health */}
      <SettingsCard>
        <SectionHeading>Estado del Sistema</SectionHeading>
        {health ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <StatusRow label="Estado" value={health.status?.toUpperCase()} color={health.status === "ok" ? "#16A34A" : "#DC2626"} />
            {health.uptime && <StatusRow label="Uptime" value={health.uptime} />}
            {health.version && <StatusRow label="Versión" value={health.version} />}
          </div>
        ) : (
          <p className="text-text-muted" style={{ fontSize: 13 }}>Cargando...</p>
        )}
      </SettingsCard>

      {/* Disk */}
      {diskUsed != null && (
        <SettingsCard>
          <SectionHeading>Almacenamiento</SectionHeading>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span className="text-text-muted">Uso de disco</span>
              <span className="text-text-main" style={{ fontWeight: 700 }}>{diskUsed}%</span>
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${diskUsed}%`,
                background: diskUsed > 90 ? "#DC2626" : diskUsed > 70 ? "#D97706" : "#16A34A",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
              <span className="text-text-muted">{diskFree != null ? `${diskFree} GB libre` : ""}</span>
              <span className="text-text-muted">{diskTotal != null ? `${diskTotal} GB total` : ""}</span>
            </div>
          </div>
          {health?.excel_files && (
            <div style={{ marginTop: 8 }}>
              <p className="text-text-muted" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Archivos Excel</p>
              {Object.entries(health.excel_files).map(([name, info]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                  <span className="text-text-sub">{name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {info.exists ? <CheckCircle size={12} style={{ color: "#16A34A" }} /> : <XCircle size={12} style={{ color: "#DC2626" }} />}
                    <span className="text-text-muted">{info.exists ? `${(info.size_mb || 0).toFixed(1)} MB` : "No encontrado"}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      )}

      {/* Polling IMAP */}
      <SettingsCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionHeading>Polling IMAP</SectionHeading>
          <button onClick={triggerPolling} disabled={pollingLoading}
            className="rounded-lg border border-border text-text-sub" style={{
              padding: "6px 14px", background: "var(--bg-hover)", fontSize: 12, fontWeight: 600,
              cursor: pollingLoading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6,
            }}>
            <ArrowClockwise size={12} /> {pollingLoading ? "Ejecutando..." : "Trigger manual"}
          </button>
        </div>
        {polling ? (
          <div>
            <StatusRow label="Última ejecución" value={polling.last_run || "Nunca"} />
            <StatusRow label="Emails encontrados" value={polling.emails_found ?? "—"} />
            <StatusRow label="Estado" value={polling.running ? "En ejecución" : "Inactivo"} color={polling.running ? "#D97706" : undefined} />
            {polling.error && <StatusRow label="Error" value={polling.error} color="#DC2626" />}
          </div>
        ) : (
          <p className="text-text-muted" style={{ fontSize: 13 }}>Sin datos de polling</p>
        )}
      </SettingsCard>

      {/* Backup */}
      <SettingsCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionHeading>Backup</SectionHeading>
          <button onClick={triggerBackup} disabled={backupLoading}
            className="rounded-lg" style={{
              padding: "6px 14px", border: "none", background: "var(--accent)", color: "#FFF",
              fontSize: 12, fontWeight: 600, cursor: backupLoading ? "wait" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              opacity: backupLoading ? 0.7 : 1,
            }}>
            <HardDrives size={12} /> {backupLoading ? "Ejecutando..." : "Ejecutar backup"}
          </button>
        </div>
        {backup ? (
          <div>
            <StatusRow label="Último backup" value={backup.last_backup || "Nunca"} />
            <StatusRow label="Destino" value={backup.destination || "—"} />
            {backup.files_copied != null && <StatusRow label="Archivos copiados" value={backup.files_copied} />}
          </div>
        ) : (
          <p className="text-text-muted" style={{ fontSize: 13 }}>Sin datos de backup</p>
        )}
      </SettingsCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Actividad tab: activity log from notifications                    */
/* ------------------------------------------------------------------ */
function ActividadTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/notifications/?limit=50")
      .then(res => setLogs(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-text-muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>Cargando actividad...</div>;

  return (
    <SettingsCard>
      <SectionHeading>Registro de actividad</SectionHeading>
      {logs.length === 0 ? (
        <p className="text-text-muted" style={{ fontSize: 13 }}>Sin actividad reciente</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" }}>
          {logs.map(log => (
            <div key={log.id} style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              padding: "8px 0", borderBottom: "1px solid var(--border)",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                background: log.tipo === "reclamacion" ? "#DB2777" : log.tipo === "exportacion" ? "#16A34A" : "#3B82F6",
              }} />
              <div style={{ flex: 1 }}>
                <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{log.titulo}</p>
                <p className="text-text-muted" style={{ fontSize: 11 }}>{log.detalle}</p>
              </div>
              <span className="text-text-muted" style={{ fontSize: 10, flexShrink: 0 }}>
                {formatDateTime(log.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Settings page                                                */
/* ------------------------------------------------------------------ */
export default function Settings({ user, onTabChange }) {
  const visibleTabs = ALL_TABS.filter(tab => tab.roles.includes(user?.role));
  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key || "cuenta");

  useEffect(() => {
    const tab = ALL_TABS.find(t => t.key === activeTab);
    onTabChange?.(tab?.label || null);
  }, [activeTab, onTabChange]);

  return (
    <div>
      <PageHeader title="Configuración" description="Preferencias, equipo y administración del sistema" />
      <TabBar tabs={visibleTabs} active={activeTab} onChange={setActiveTab} layoutId="settings-tab-indicator" />
      <div style={{ marginTop: 20 }}>
        {activeTab === "cuenta" && <GeneralTab />}
        {activeTab === "equipo" && <EquipoTab readOnly={user?.role === "Project Manager"} user={user} />}
        {activeTab === "plantillas" && <PlantillasTab />}
        {activeTab === "integraciones" && <IntegracionesTab />}
        {activeTab === "sistema" && <SistemaTab />}
        {activeTab === "webhooks" && <WebhooksTab />}
        {activeTab === "api" && <ApiKeysTab />}
        {activeTab === "actividad" && <ActividadTab />}
        {activeTab === "facturacion" && <FacturacionTab />}
        {activeTab === "sincronizacion" && <SincronizacionTab />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Webhooks tab: webhook configuration                                */
/* ------------------------------------------------------------------ */
function WebhooksTab() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", url: "", platform: "generic", events: [], enabled: true });

  const PLATFORMS = ["slack", "teams", "generic"];
  const EVENTS = ["document_updated", "status_changed", "document_received", "approval_resolved", "comment_added"];

  const load = () => {
    setLoading(true);
    api.get("/webhooks/").then(r => setWebhooks(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSave = async () => {
    try {
      if (editing && editing !== "new") {
        await api.put(`/webhooks/${editing.id}`, form);
        showToast(t("webhookUpdated"), "success");
      } else {
        await api.post("/webhooks/", form);
        showToast(t("webhookCreated"), "success");
      }
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("webhookDeleteConfirm"))) return;
    try {
      await api.delete(`/webhooks/${id}`);
      showToast(t("webhookDeleted"), "success");
      load();
    } catch {
      showToast("Error", "error");
    }
  };

  const handleTest = async (id) => {
    try {
      await api.post(`/webhooks/${id}/test`);
      showToast(t("webhookTestSent"), "success");
    } catch {
      showToast(t("webhookTestFail"), "error");
    }
  };

  const toggleEvent = (event) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter(e => e !== event) : [...f.events, event],
    }));
  };

  if (loading) return <div className="text-text-muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>{t("loading")}</div>;

  if (editing) {
    return (
      <SettingsCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <SectionHeading>{editing === "new" ? t("webhookNew") : t("webhookEdit")}</SectionHeading>
          <button onClick={() => setEditing(null)} className="text-text-muted" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
            {t("cancel")}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 500 }}>
          <div>
            <label className="text-text-muted" style={labelStyle}>{t("webhookName")}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" style={{ width: "100%" }} placeholder="My Slack Webhook" />
          </div>
          <div>
            <label className="text-text-muted" style={labelStyle}>URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="input-field" style={{ width: "100%" }} placeholder="https://hooks.slack.com/..." />
          </div>
          <div>
            <label className="text-text-muted" style={labelStyle}>{t("webhookPlatform")}</label>
            <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="input-field" style={{ width: "100%" }}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-text-muted" style={labelStyle}>{t("webhookEvents")}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EVENTS.map(ev => (
                <button key={ev} onClick={() => toggleEvent(ev)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: form.events.includes(ev) ? "var(--accent)" : "var(--bg-input)",
                  color: form.events.includes(ev) ? "#FFF" : "var(--text-muted)",
                  border: `1px solid ${form.events.includes(ev) ? "var(--accent)" : "var(--border)"}`,
                }}>
                  {ev}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSave} disabled={!form.name || !form.url} className="rounded-lg" style={{
            padding: "8px 20px", border: "none", background: "var(--accent)", color: "#FFF",
            fontSize: 13, fontWeight: 600, cursor: "pointer", width: "fit-content",
            opacity: (!form.name || !form.url) ? 0.5 : 1,
          }}>
            {t("save")}
          </button>
        </div>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>Webhooks</SectionHeading>
        <button onClick={() => { setEditing("new"); setForm({ name: "", url: "", platform: "generic", events: [], enabled: true }); }}
          className="rounded-lg" style={{
            padding: "6px 14px", border: "none", background: "var(--accent)", color: "#FFF",
            fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
          <Plus size={12} weight="bold" /> {t("webhookNew")}
        </button>
      </div>
      {webhooks.length === 0 ? (
        <div className="text-text-muted" style={{ padding: 40, textAlign: "center" }}>
          <Plugs size={32} style={{ margin: "0 auto 8px", display: "block", opacity: 0.3 }} />
          <p style={{ fontSize: 13 }}>{t("webhookNone")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {webhooks.map(w => (
            <div key={w.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              borderRadius: 8, border: "1px solid var(--border)",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: w.enabled ? "#16A34A" : "var(--text-muted)",
              }} />
              <div style={{ flex: 1 }}>
                <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{w.name}</p>
                <p className="text-text-muted" style={{ fontSize: 11 }}>{w.platform} &middot; {(w.events || []).length} events</p>
              </div>
              <button onClick={() => handleTest(w.id)} className="text-text-muted" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                Test
              </button>
              <button onClick={() => { setEditing(w); setForm({ name: w.name, url: w.url, platform: w.platform, events: w.events || [], enabled: w.enabled }); }}
                className="text-text-muted" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <PencilSimple size={14} />
              </button>
              <button onClick={() => handleDelete(w.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

/* ------------------------------------------------------------------ */
/*  API Keys tab: manage API keys                                      */
/* ------------------------------------------------------------------ */
function ApiKeysTab() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const tenant = useTenant();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", scopes: ["read"], expires_days: null });
  const [newKey, setNewKey] = useState(null);

  const SCOPES = ["read", "write", "documents", "reports", "webhooks"];

  const load = () => {
    setLoading(true);
    api.get("/api-keys/").then(r => setKeys(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    try {
      const { data } = await api.post("/api-keys/", form);
      setNewKey(data.raw_key);
      showToast(t("apiKeyCreated"), "success");
      setShowCreate(false);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("apiKeyDeleteConfirm"))) return;
    try {
      await api.delete(`/api-keys/${id}`);
      showToast(t("apiKeyDeleted"), "success");
      load();
    } catch {
      showToast("Error", "error");
    }
  };

  const toggleScope = (scope) => {
    setForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }));
  };

  if (!tenant.hasFeature?.("api_keys") && tenant.plan !== "enterprise") {
    return (
      <SettingsCard>
        <div className="text-text-muted" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{t("apiKeyEnterprise")}</p>
        </div>
      </SettingsCard>
    );
  }

  if (loading) return <div className="text-text-muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>{t("loading")}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* New key reveal */}
      {newKey && (
        <SettingsCard style={{ borderLeft: "4px solid #D97706" }}>
          <div style={{ marginBottom: 8 }}>
            <p className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{t("apiKeyCopyWarning")}</p>
          </div>
          <div style={{
            padding: "10px 14px", borderRadius: 8, background: "var(--bg-page)", fontFamily: "monospace",
            fontSize: 13, wordBreak: "break-all", color: "var(--text-main)",
          }}>
            {newKey}
          </div>
          <button onClick={() => { navigator.clipboard.writeText(newKey); showToast("Copied!", "success"); }}
            className="rounded-lg" style={{
              marginTop: 8, padding: "6px 16px", border: "none", background: "var(--accent)",
              color: "#FFF", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
            {t("apiKeyCopy")}
          </button>
        </SettingsCard>
      )}

      <SettingsCard>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <SectionHeading>API Keys</SectionHeading>
          <button onClick={() => setShowCreate(!showCreate)} className="rounded-lg" style={{
            padding: "6px 14px", border: "none", background: "var(--accent)", color: "#FFF",
            fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Plus size={12} weight="bold" /> {t("apiKeyNew")}
          </button>
        </div>

        {showCreate && (
          <div style={{ marginBottom: 16, padding: 16, borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
              <div>
                <label className="text-text-muted" style={labelStyle}>{t("apiKeyName")}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" style={{ width: "100%" }} placeholder="My Integration" />
              </div>
              <div>
                <label className="text-text-muted" style={labelStyle}>Scopes</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SCOPES.map(s => (
                    <button key={s} onClick={() => toggleScope(s)} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      background: form.scopes.includes(s) ? "var(--accent)" : "var(--bg-input)",
                      color: form.scopes.includes(s) ? "#FFF" : "var(--text-muted)",
                      border: `1px solid ${form.scopes.includes(s) ? "var(--accent)" : "var(--border)"}`,
                    }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleCreate} disabled={!form.name} className="rounded-lg" style={{
                padding: "8px 20px", border: "none", background: "var(--accent)", color: "#FFF",
                fontSize: 13, fontWeight: 600, cursor: "pointer", width: "fit-content",
                opacity: !form.name ? 0.5 : 1,
              }}>
                {t("apiKeyGenerate")}
              </button>
            </div>
          </div>
        )}

        {keys.length === 0 && !showCreate ? (
          <div className="text-text-muted" style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: 13 }}>{t("apiKeyNone")}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {keys.map(k => (
              <div key={k.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderRadius: 8, border: "1px solid var(--border)",
              }}>
                <div style={{ flex: 1 }}>
                  <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{k.name}</p>
                  <p className="text-text-muted" style={{ fontSize: 11 }}>
                    {k.key_prefix}... &middot; {(k.scopes || []).join(", ")} &middot; {k.last_used_at ? `Last used: ${new Date(k.last_used_at).toLocaleDateString()}` : t("never")}
                  </p>
                </div>
                <button onClick={() => handleDelete(k.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Facturación tab: real Stripe data + plan comparison                */
/* ------------------------------------------------------------------ */
function FacturacionTab() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const tenant = useTenant();

  const [billingInfo, setBillingInfo] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const PLAN_COLORS = { free: "#71717A", pro: "#4F46E5", enterprise: "#D97706" };
  const STATUS_COLORS = { active: "#16A34A", past_due: "#D97706", canceled: "#DC2626", trialing: "#3B82F6" };
  const STATUS_LABELS = { active: "billingStatusActive", past_due: "billingStatusPastDue", canceled: "billingStatusCanceled", trialing: "billingStatusTrialing" };

  const PLANS = [
    {
      key: "free", price: t("billingFree"), users: "3", docs: "500", api: "5,000",
      features: { email_parsing: true, claims: true, workflows: false, ai: false, custom_reports: false, docusign: false, scheduled_reports: false, api_access: false },
    },
    {
      key: "pro", price: `$49${t("billingMonth")}`, users: "15", docs: "10,000", api: "50,000",
      features: { email_parsing: true, claims: true, workflows: true, ai: true, custom_reports: true, docusign: true, scheduled_reports: true, api_access: true },
    },
    {
      key: "enterprise", price: t("billingCustom"), users: t("billingUnlimited"), docs: t("billingUnlimited"), api: t("billingUnlimited"),
      features: { email_parsing: true, claims: true, workflows: true, ai: true, custom_reports: true, docusign: true, scheduled_reports: true, api_access: true },
    },
  ];

  const FEATURE_LABELS = {
    email_parsing: "featureEmailParsing",
    claims: "featureClaims",
    workflows: "featureWorkflows",
    ai: "featureAi",
    custom_reports: "featureCustomReports",
    docusign: "featureDocusign",
    scheduled_reports: "featureScheduledReports",
    api_access: "featureApiAccess",
  };

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get("/billing/info"),
      api.get("/billing/usage"),
    ]).then(([bRes, uRes]) => {
      if (bRes.status === "fulfilled") setBillingInfo(bRes.value.data);
      if (uRes.status === "fulfilled") setUsage(uRes.value.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleManagePlan = async () => {
    try {
      const { data } = await api.post("/billing/portal", { return_url: window.location.href });
      window.open(data.url, "_blank");
    } catch {
      showToast(t("billingStripeNotConfigured"), "error");
    }
  };

  const handleUpgrade = async (plan) => {
    try {
      const { data } = await api.post("/billing/checkout", {
        plan,
        success_url: window.location.href,
        cancel_url: window.location.href,
      });
      window.open(data.url, "_blank");
    } catch {
      showToast(t("billingStripeNotConfigured"), "error");
    }
  };

  const plan = billingInfo?.plan || tenant.plan || "free";
  const status = billingInfo?.status || "active";
  const limits = usage?.limits || tenant.limits || {};
  const current = usage?.current || {};

  const usageItems = [
    { label: t("adminApiCalls"), used: current.api_calls || 0, limit: limits.max_api_calls_per_month },
    { label: t("adminDocsCreated"), used: current.documents_created || 0, limit: limits.max_documents },
    { label: t("adminEmailsSent"), used: current.emails_sent || 0, limit: 1000 },
  ];

  if (loading)
    return <div className="text-text-muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>{t("loading")}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Current plan */}
      <SettingsCard>
        <SectionHeading>{t("billingCurrentPlan")}</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 6,
              background: `${PLAN_COLORS[plan] || "#71717A"}20`,
              color: PLAN_COLORS[plan] || "#71717A",
              textTransform: "uppercase",
            }}>
              {plan}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 4,
              background: `${STATUS_COLORS[status] || "#71717A"}20`,
              color: STATUS_COLORS[status] || "#71717A",
            }}>
              {t(STATUS_LABELS[status] || "billingStatusActive")}
            </span>
          </div>

          {billingInfo?.current_period_start && billingInfo?.current_period_end && (
            <div style={{ fontSize: 12 }}>
              <span className="text-text-muted">{t("billingPeriod")}: </span>
              <span className="text-text-main" style={{ fontWeight: 600 }}>
                {new Date(billingInfo.current_period_start).toLocaleDateString()} — {new Date(billingInfo.current_period_end).toLocaleDateString()}
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={handleManagePlan}
              className="rounded-lg border border-border"
              style={{
                padding: "8px 18px", background: "var(--bg-hover)", color: "var(--text-main)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {t("billingManagePlan")}
            </button>
            {plan === "free" && (
              <button
                onClick={() => handleUpgrade("pro")}
                className="rounded-lg"
                style={{
                  padding: "8px 18px", border: "none",
                  background: "var(--accent)", color: "#FFF",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                {t("billingUpgrade")}
              </button>
            )}
          </div>
        </div>
      </SettingsCard>

      {/* Usage this month */}
      <SettingsCard>
        <SectionHeading>{t("billingUsageThisMonth")}</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {usageItems.map(item => {
            const limit = item.limit === -1 ? null : item.limit;
            const pct = limit ? Math.min(100, (item.used / limit) * 100) : 0;
            const color = pct > 90 ? "#DC2626" : pct > 70 ? "#D97706" : "#16A34A";
            return (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span className="text-text-muted">{item.label}</span>
                  <span className="text-text-main" style={{ fontWeight: 700 }}>
                    {item.used.toLocaleString()} / {limit ? limit.toLocaleString() : t("billingUnlimited")}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: limit ? `${pct}%` : "0%", background: color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {/* Usage history chart */}
      {usage?.history && usage.history.length > 0 && (
        <SettingsCard>
          <SectionHeading>{t("billingUsageHistory")}</SectionHeading>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage.history}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-card)", border: "1px solid var(--border)",
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Bar dataKey="api_calls" fill="#4F46E5" radius={[4, 4, 0, 0]} name={t("adminApiCalls")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SettingsCard>
      )}

      {/* Plan comparison */}
      <SettingsCard>
        <SectionHeading>{t("billingComparePlans")}</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {PLANS.map(p => (
            <div key={p.key} style={{
              padding: 16, borderRadius: 10, border: `2px solid ${p.key === plan ? (PLAN_COLORS[p.key] || "var(--border)") : "var(--border)"}`,
              background: p.key === plan ? `${PLAN_COLORS[p.key]}08` : "transparent",
            }}>
              <h4 style={{
                fontSize: 14, fontWeight: 700, textTransform: "uppercase",
                color: PLAN_COLORS[p.key] || "var(--text-main)", marginBottom: 4,
              }}>
                {p.key}
              </h4>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-main)", marginBottom: 12 }}>
                {p.price}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-text-muted">{t("billingMaxUsers")}</span>
                  <span className="text-text-main" style={{ fontWeight: 600 }}>{p.users}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-text-muted">{t("billingMaxDocs")}</span>
                  <span className="text-text-main" style={{ fontWeight: 600 }}>{p.docs}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-text-muted">{t("billingApiCalls")}</span>
                  <span className="text-text-main" style={{ fontWeight: 600 }}>{p.api}</span>
                </div>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
                  {Object.entries(p.features).map(([feat, enabled]) => (
                    <div key={feat} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0" }}>
                      {enabled ? (
                        <Check size={12} weight="bold" style={{ color: "#16A34A" }} />
                      ) : (
                        <X size={12} style={{ color: "var(--text-muted)", opacity: 0.3 }} />
                      )}
                      <span style={{ color: enabled ? "var(--text-main)" : "var(--text-muted)", fontSize: 11, opacity: enabled ? 1 : 0.5 }}>
                        {t(FEATURE_LABELS[feat])}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sincronizacion tab: folder sync                                   */
/* ------------------------------------------------------------------ */
function SincronizacionTab() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/folder-sync/status"),
      api.get("/folder-sync/history"),
    ]).then(([statusRes, historyRes]) => {
      setStatus(statusRes.data);
      setHistory(historyRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const triggerScan = async () => {
    setScanning(true);
    try {
      const res = await api.post("/folder-sync/scan");
      setScanResult(res.data);
      setStatus(prev => ({
        ...prev,
        last_scan: res.data.scan_time,
        total_files: res.data.total_scanned,
        last_new_count: res.data.new_files?.length || 0,
        last_modified_count: res.data.modified_files?.length || 0,
      }));
      // Refresh history
      api.get("/folder-sync/history").then(r => setHistory(r.data)).catch(() => {});
      showToast(t("fsTriggerScan") + " OK", "success");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Error escaneando", "error");
    } finally { setScanning(false); }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (loading) return <div className="text-text-muted" style={{ padding: 40, textAlign: "center" }}>Cargando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Status card */}
      <SettingsCard>
        <SectionHeading>{t("fsTitle") || "Sincronizacion de carpetas"}</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: status?.path_accessible ? "#16A34A15" : "#DC262615", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {status?.path_accessible ? <CheckCircle size={18} weight="bold" style={{ color: "#16A34A" }} /> : <XCircle size={18} weight="bold" style={{ color: "#DC2626" }} />}
            </div>
            <div>
              <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>{t("fsStatus") || "Estado"}</p>
              <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>
                {status?.path_accessible ? "Conectado" : (t("fsNoAccess") || "No accesible")}
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#4F46E515", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderSimple size={18} weight="bold" style={{ color: "#4F46E5" }} />
            </div>
            <div>
              <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>{t("fsTotalScanned") || "Total archivos"}</p>
              <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{(status?.total_files || 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#D9770615", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} weight="bold" style={{ color: "#D97706" }} />
            </div>
            <div>
              <p className="text-text-muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>{t("fsLastScan") || "Ultimo escaneo"}</p>
              <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>
                {status?.last_scan ? formatDateTime(status.last_scan) : "Nunca"}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <p className="text-text-muted" style={{ fontSize: 11 }}>
            Ruta: <code style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--bg-page)", border: "1px solid var(--border)" }}>{status?.base_path || "N/A"}</code>
          </p>
          <div className="flex-1" />
          <button onClick={triggerScan} disabled={scanning} className="rounded-lg" style={{
            padding: "8px 16px", border: "none", background: "var(--accent)", color: "#FFF",
            fontSize: 12, fontWeight: 600, cursor: scanning ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6, opacity: scanning ? 0.7 : 1,
          }}>
            <ArrowClockwise size={14} weight="bold" className={scanning ? "animate-spin" : ""} />
            {scanning ? (t("fsScanning") || "Escaneando...") : (t("fsTriggerScan") || "Escanear ahora")}
          </button>
        </div>
      </SettingsCard>

      {/* Scan result - new files */}
      {scanResult?.new_files?.length > 0 && (
        <SettingsCard>
          <SectionHeading>
            <FileText size={14} weight="bold" style={{ display: "inline", marginRight: 6 }} />
            {t("fsNewFiles") || "Archivos nuevos"} ({scanResult.new_files.length})
          </SectionHeading>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Archivo</th>
                  <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Extension</th>
                  <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Tamano</th>
                </tr>
              </thead>
              <tbody>
                {scanResult.new_files.slice(0, 50).map((f, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="text-text-main" style={{ padding: "6px 8px", fontSize: 12, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={f.relative_path || f.path}>
                      {f.relative_path || f.name}
                    </td>
                    <td className="text-text-sub" style={{ padding: "6px 8px" }}>
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--bg-page)", border: "1px solid var(--border)" }}>{f.extension}</span>
                    </td>
                    <td className="text-text-sub" style={{ padding: "6px 8px", textAlign: "right" }}>{formatSize(f.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      )}

      {/* History */}
      {history.length > 0 && (
        <SettingsCard>
          <SectionHeading>{t("fsHistory") || "Historial de escaneos"}</SectionHeading>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Fecha</th>
                <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Total</th>
                <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Nuevos</th>
                <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Modificados</th>
                <th className="text-text-muted" style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="text-text-main" style={{ padding: "6px 8px" }}>{h.scan_time ? formatDateTime(h.scan_time) : "-"}</td>
                  <td className="text-text-sub" style={{ padding: "6px 8px", textAlign: "right" }}>{h.total_scanned || 0}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: h.new_files > 0 ? "#16A34A" : "var(--text-muted)" }}>{h.new_files || 0}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: h.modified_files > 0 ? "#D97706" : "var(--text-muted)" }}>{h.modified_files || 0}</td>
                  <td style={{ padding: "6px 8px" }}>
                    {h.error ? (
                      <span style={{ fontSize: 10, color: "#DC2626" }}>{h.error}</span>
                    ) : (
                      <CheckCircle size={14} weight="bold" style={{ color: "#16A34A" }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SettingsCard>
      )}
    </div>
  );
}
