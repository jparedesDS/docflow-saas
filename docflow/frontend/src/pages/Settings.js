import React, { useState, useEffect } from "react";
import {
  Eye, EyeSlash, PencilSimple, Trash, Plus, FloppyDisk,
  ArrowClockwise, CheckCircle, XCircle, HardDrives, EnvelopeSimple,
  FileText, Plugs,
} from "@phosphor-icons/react";
import PageHeader from "../components/PageHeader";
import TabBar from "../components/TabBar";
import { useTheme } from "../contexts/ThemeContext";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import api from "../services/api";

const ALL_TABS = [
  { key: "cuenta", label: "Cuenta", roles: ["Document Controller", "Project Manager", "Comercial"] },
  { key: "equipo", label: "Equipo", roles: ["Document Controller", "Project Manager"] },
  { key: "plantillas", label: "Plantillas", roles: ["Document Controller"] },
  { key: "integraciones", label: "Integraciones", roles: ["Document Controller"] },
  { key: "sistema", label: "Sistema", roles: ["Document Controller"] },
  { key: "actividad", label: "Actividad", roles: ["Document Controller", "Project Manager"] },
  { key: "facturacion", label: "Facturación", roles: ["Document Controller"] },
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
  const { lang, toggleLang } = useI18n();
  const { showToast } = useToast();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Equipo tab: team members from /auth/users                         */
/* ------------------------------------------------------------------ */
function EquipoTab({ readOnly }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/users")
      .then(res => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const ROLE_COLORS = {
    "Document Controller": "#4F46E5",
    "Project Manager": "#0D9488",
    Comercial: "#D97706",
  };

  if (loading)
    return <div className="text-text-muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>Cargando equipo...</div>;

  return (
    <SettingsCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <SectionHeading>Equipo</SectionHeading>
        {readOnly && <span className="text-text-muted" style={{ fontSize: 11 }}>Solo lectura</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {users.map(u => (
          <div key={u.username} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: ROLE_COLORS[u.role] || "#71717A",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#FFF", fontSize: 12, fontWeight: 700,
            }}>
              {u.initials || u.username.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600 }}>{u.name || u.username}</p>
              <p className="text-text-muted" style={{ fontSize: 11 }}>{u.username}</p>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: (ROLE_COLORS[u.role] || "#71717A") + "20",
              color: ROLE_COLORS[u.role] || "#71717A",
            }}>
              {u.role}
            </span>
          </div>
        ))}
      </div>
    </SettingsCard>
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
    </SettingsCard>
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
    </SettingsCard>
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
                {new Date(log.timestamp).toLocaleString("es-ES")}
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
        {activeTab === "equipo" && <EquipoTab readOnly={user?.role === "Project Manager"} />}
        {activeTab === "plantillas" && <PlantillasTab />}
        {activeTab === "integraciones" && <IntegracionesTab />}
        {activeTab === "sistema" && <SistemaTab />}
        {activeTab === "actividad" && <ActividadTab />}
        {activeTab === "facturacion" && <FacturacionTab />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Facturación tab (placeholder)                                      */
/* ------------------------------------------------------------------ */
function FacturacionTab() {
  const usageData = [
    { label: "Emails enviados", used: 342, limit: 1000 },
    { label: "API calls (mes)", used: 1250, limit: 5000 },
    { label: "Almacenamiento", used: 2.4, limit: 10, unit: "GB" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SettingsCard>
        <SectionHeading>Plan actual</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span className="text-text-muted">Plan</span>
            <span className="text-text-main" style={{ fontWeight: 700 }}>Enterprise</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span className="text-text-muted">Usuarios</span>
            <span className="text-text-main" style={{ fontWeight: 700 }}>9 / 25</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span className="text-text-muted">Documentos</span>
            <span className="text-text-main" style={{ fontWeight: 700 }}>Ilimitados</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span className="text-text-muted">Renovación</span>
            <span className="text-text-main" style={{ fontWeight: 700 }}>Anual</span>
          </div>
          <button disabled style={{
            marginTop: 8, padding: "8px 20px", border: "1px solid var(--border)",
            borderRadius: 8, background: "var(--bg-hover)", color: "var(--text-muted)",
            fontSize: 13, fontWeight: 600, cursor: "not-allowed", width: "fit-content",
          }}>
            Gestionar plan
          </button>
        </div>
      </SettingsCard>

      <SettingsCard>
        <SectionHeading>Uso este mes</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {usageData.map(item => {
            const pct = Math.min(100, (item.used / item.limit) * 100);
            const color = pct > 90 ? "#DC2626" : pct > 70 ? "#D97706" : "#16A34A";
            return (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span className="text-text-muted">{item.label}</span>
                  <span className="text-text-main" style={{ fontWeight: 700 }}>
                    {item.used}{item.unit ? ` ${item.unit}` : ""} / {item.limit}{item.unit ? ` ${item.unit}` : ""}
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </div>
  );
}
