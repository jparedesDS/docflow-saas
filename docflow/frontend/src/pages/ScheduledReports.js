import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, EnvelopeSimple, ClockCountdown, FileText,
  Lightning, Play, Eye, Gear, Check, X, Warning,
} from "@phosphor-icons/react";
import { useToast } from "../contexts/ToastContext";
import { useI18n } from "../contexts/I18nContext";
import api from "../services/api";

function getDaysOfWeek(t) {
  return [
    { value: "mon", label: t('srDayMon') },
    { value: "tue", label: t('srDayTue') },
    { value: "wed", label: t('srDayWed') },
    { value: "thu", label: t('srDayThu') },
    { value: "fri", label: t('srDayFri') },
    { value: "sat", label: t('srDaySat') },
    { value: "sun", label: t('srDaySun') },
  ];
}

const ICON_MAP = {
  executive: EnvelopeSimple,
  personal: EnvelopeSimple,
  claims: Warning,
  "monthly-pdf": FileText,
};

const COLOR_MAP = {
  executive: "#4F46E5",
  personal: "#0D9488",
  claims: "#D97706",
  "monthly-pdf": "#2563EB",
};

function formatLastRun(lr) {
  if (!lr) return null;
  try {
    const d = new Date(lr.timestamp);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })
      + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch { return lr.timestamp; }
}

function scheduleLabel(sched, frequency, t) {
  if (frequency === "monthly") {
    return `Día ${sched.day_of_month || 1}, ${String(sched.hour).padStart(2, "0")}:${String(sched.minute).padStart(2, "0")}`;
  }
  const daysOfWeek = getDaysOfWeek(t);
  const day = daysOfWeek.find(d => d.value === sched.day_of_week);
  return `${day?.label || sched.day_of_week} ${String(sched.hour).padStart(2, "0")}:${String(sched.minute).padStart(2, "0")}`;
}

// ─── Email chip input ────────────────────────────────────────────────────────

function EmailChipInput({ value, onChange, teamUsers, label }) {
  const [inputVal, setInputVal] = useState("");

  const addEmail = (email) => {
    const e = email.trim().toLowerCase();
    if (e && !value.includes(e)) onChange([...value, e]);
    setInputVal("");
  };

  const removeEmail = (email) => onChange(value.filter(e => e !== email));

  const handleKeyDown = (ev) => {
    if (ev.key === "Enter" || ev.key === ",") {
      ev.preventDefault();
      if (inputVal.trim()) addEmail(inputVal);
    }
  };

  const availableTeam = teamUsers.filter(u => !value.includes(u.email));

  return (
    <div style={{ marginBottom: 16 }}>
      <label className="text-text-muted" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6,
        padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8,
        background: "var(--bg-card)", minHeight: 40,
      }}>
        {value.map(email => (
          <span key={email} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500,
            background: "var(--bg-hover)", color: "var(--text-main)",
          }}>
            {email}
            <X size={12} weight="bold" style={{ cursor: "pointer", opacity: 0.6 }} onClick={() => removeEmail(email)} />
          </span>
        ))}
        <input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputVal.trim()) addEmail(inputVal); }}
          placeholder="email@ejemplo.com"
          style={{
            flex: 1, minWidth: 140, border: "none", outline: "none",
            background: "transparent", color: "var(--text-main)", fontSize: 13,
          }}
        />
      </div>
      {availableTeam.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {availableTeam.map(u => (
            <button key={u.initials} onClick={() => addEmail(u.email)} style={{
              padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 6,
              background: "var(--bg-card)", color: "var(--text-muted)", fontSize: 11,
              cursor: "pointer",
            }}>
              + {u.initials}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User filter selector ────────────────────────────────────────────────────

function UserFilterSelector({ value, onChange, teamUsers, t }) {
  const isAll = value === "all";

  return (
    <div style={{ marginBottom: 16 }}>
      <label className="text-text-muted" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
        {t('srRecipientUsers')}
      </label>
      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-main)", cursor: "pointer" }}>
          <input type="radio" checked={isAll} onChange={() => onChange("all")} /> {t('srAll')}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-main)", cursor: "pointer" }}>
          <input type="radio" checked={!isAll} onChange={() => { if (isAll) onChange([]); }} /> {t('srSelect')}
        </label>
      </div>
      {!isAll && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {teamUsers.map(u => {
            const selected = Array.isArray(value) && value.includes(u.initials);
            return (
              <button key={u.initials} onClick={() => {
                const cur = Array.isArray(value) ? value : [];
                onChange(selected ? cur.filter(i => i !== u.initials) : [...cur, u.initials]);
              }} style={{
                padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                border: selected ? "2px solid #4F46E5" : "1px solid var(--border)",
                background: selected ? "#4F46E514" : "var(--bg-card)",
                color: selected ? "#4F46E5" : "var(--text-muted)",
                cursor: "pointer",
              }}>
                {u.initials} — {u.nombre}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ScheduledReports({ onBack }) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [schedules, setSchedules] = useState([]);
  const [teamUsers, setTeamUsers] = useState([]);
  const [editing, setEditing] = useState(null); // schedule id or null
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [schedRes, teamRes] = await Promise.all([
        api.get("/schedules/"),
        api.get("/schedules/team"),
      ]);
      setSchedules(schedRes.data);
      setTeamUsers(teamRes.data);
    } catch (e) {
      showToast("Error al cargar reportes programados", "error");
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Toggle enabled ─────────────────────────────────────────────────

  const handleToggle = async (sched) => {
    try {
      await api.put(`/schedules/${sched.id}`, { enabled: !sched.enabled });
      showToast(`${sched.title} ${sched.enabled ? "desactivado" : "activado"}`, "success");
      fetchData();
    } catch {
      showToast("Error al actualizar", "error");
    }
  };

  // ─── Execute now ─────────────────────────────────────────────────────

  const handleExecute = async (sched) => {
    setActionLoading(sched.id);
    try {
      const res = await api.post(`/schedules/${sched.id}/execute`);
      if (res.data.status === "success") {
        showToast(`${sched.title} ejecutado correctamente`, "success");
      } else {
        showToast(res.data.error || "Error al ejecutar", "error");
      }
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.detail || "Error al ejecutar", "error");
    }
    setActionLoading(null);
  };

  // ─── Preview ─────────────────────────────────────────────────────────

  const handlePreview = async (sched) => {
    setActionLoading(sched.id);
    try {
      const res = await api.get(`/schedules/${sched.id}/preview`, { responseType: "text" });
      const w = window.open("", "_blank");
      w.document.write(res.data);
      w.document.close();
    } catch {
      showToast("Error al generar preview", "error");
    }
    setActionLoading(null);
  };

  // ─── Edit form ───────────────────────────────────────────────────────

  const startEditing = (sched) => {
    setForm({
      enabled: sched.enabled,
      day_of_week: sched.schedule.day_of_week || "mon",
      day_of_month: sched.schedule.day_of_month || 1,
      hour: sched.schedule.hour,
      minute: sched.schedule.minute,
      to: sched.recipients.to || [],
      cc: sched.recipients.cc || [],
      user_filter: sched.options.user_filter || "all",
    });
    setEditing(sched.id);
  };

  const handleSave = async () => {
    const sched = schedules.find(s => s.id === editing);
    const payload = {
      enabled: form.enabled,
      schedule: sched.frequency === "monthly"
        ? { day_of_month: form.day_of_month, hour: form.hour, minute: form.minute }
        : { day_of_week: form.day_of_week, hour: form.hour, minute: form.minute },
      recipients: { to: form.to, cc: form.cc },
      options: { user_filter: form.user_filter },
    };
    try {
      await api.put(`/schedules/${editing}`, payload);
      showToast("Configuración guardada", "success");
      setEditing(null);
      fetchData();
    } catch {
      showToast("Error al guardar", "error");
    }
  };

  // ─── Render: Edit form ───────────────────────────────────────────────

  if (editing) {
    const sched = schedules.find(s => s.id === editing);
    if (!sched) return null;

    return (
      <div>
        <button onClick={() => setEditing(null)} className="text-text-muted" style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0,
        }}>
          <ArrowLeft size={16} /> Volver a lista
        </button>

        <div className="card" style={{ padding: 24, maxWidth: 600 }}>
          <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            {sched.title}
          </h3>
          <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 20 }}>
            {sched.description}
          </p>

          {/* Enabled toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <label className="text-text-muted" style={{ fontSize: 12, fontWeight: 600 }}>{t('srEnabled')}</label>
            <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))} style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", position: "relative",
              background: form.enabled ? "#4F46E5" : "var(--border)", transition: "background 0.2s",
            }}>
              <span style={{
                position: "absolute", top: 2, left: form.enabled ? 22 : 2,
                width: 20, height: 20, borderRadius: 10, background: "#fff",
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>

          {/* Schedule */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            {sched.frequency === "weekly" ? (
              <div style={{ flex: 1 }}>
                <label className="text-text-muted" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Día</label>
                <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}
                  className="text-text-main" style={{
                    width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
                    borderRadius: 8, background: "var(--bg-card)", fontSize: 13,
                  }}>
                  {getDaysOfWeek(t).map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <label className="text-text-muted" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Día del mes</label>
                <select value={form.day_of_month} onChange={e => setForm(f => ({ ...f, day_of_month: parseInt(e.target.value) }))}
                  className="text-text-main" style={{
                    width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
                    borderRadius: 8, background: "var(--bg-card)", fontSize: 13,
                  }}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>Día {d}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ width: 80 }}>
              <label className="text-text-muted" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Hora</label>
              <input type="number" min={0} max={23} value={form.hour}
                onChange={e => setForm(f => ({ ...f, hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) }))}
                className="text-text-main" style={{
                  width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
                  borderRadius: 8, background: "var(--bg-card)", fontSize: 13,
                }} />
            </div>
            <div style={{ width: 80 }}>
              <label className="text-text-muted" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Min</label>
              <input type="number" min={0} max={59} value={form.minute}
                onChange={e => setForm(f => ({ ...f, minute: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) }))}
                className="text-text-main" style={{
                  width: "100%", padding: "8px 10px", border: "1px solid var(--border)",
                  borderRadius: 8, background: "var(--bg-card)", fontSize: 13,
                }} />
            </div>
          </div>

          {/* Recipients — executive & claims: TO + CC; personal: CC only; monthly-pdf: none */}
          {(sched.type === "executive" || sched.type === "claims") && (
            <EmailChipInput value={form.to} onChange={to => setForm(f => ({ ...f, to }))} teamUsers={teamUsers} label="Destinatarios (TO)" />
          )}
          {sched.type !== "monthly-pdf" && (
            <EmailChipInput value={form.cc} onChange={cc => setForm(f => ({ ...f, cc }))} teamUsers={teamUsers} label="Copia (CC)" />
          )}

          {/* User filter (only for personal type) */}
          {sched.type === "personal" && (
            <UserFilterSelector value={form.user_filter} onChange={uf => setForm(f => ({ ...f, user_filter: uf }))} teamUsers={teamUsers} t={t} />
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <button onClick={handleSave} style={{
              flex: 1, padding: "10px 0", border: "none", borderRadius: 8,
              background: "#4F46E5", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              {t("save")}
            </button>
            <button onClick={() => setEditing(null)} style={{
              flex: 1, padding: "10px 0", border: "1px solid var(--border)", borderRadius: 8,
              background: "var(--bg-card)", color: "var(--text-main)", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              {t("cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: List view ───────────────────────────────────────────────

  return (
    <div>
      <button onClick={onBack} className="text-text-muted" style={{
        display: "flex", alignItems: "center", gap: 6, background: "none",
        border: "none", cursor: "pointer", fontSize: 13, marginBottom: 16, padding: 0,
      }}>
        <ArrowLeft size={16} /> {t("scheduleBack")}
      </button>

      <div style={{ marginBottom: 20 }}>
        <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          {t("scheduledReports")}
        </h3>
        <p className="text-text-muted" style={{ fontSize: 13 }}>
          {t('rcConfigAutoSend')}
        </p>
      </div>

      {loading ? (
        <p className="text-text-muted" style={{ fontSize: 13 }}>{t("loading")}</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {schedules.map(sched => {
            const Icon = ICON_MAP[sched.type] || ClockCountdown;
            const color = COLOR_MAP[sched.type] || "#64748B";
            const lr = sched.last_run;
            const isActLoading = actionLoading === sched.id;

            return (
              <div key={sched.id} className="card" style={{
                padding: 20, display: "flex", flexDirection: "column",
                opacity: sched.enabled ? 1 : 0.65, transition: "opacity 0.2s",
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon size={20} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-text-main" style={{ fontSize: 14, fontWeight: 700 }}>{sched.title}</p>
                      <p className="text-text-muted" style={{ fontSize: 12 }}>{sched.description}</p>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <button onClick={() => handleToggle(sched)} title={sched.enabled ? t('srDisabled') : t('srEnabled')} style={{
                    width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                    position: "relative", flexShrink: 0, marginTop: 2,
                    background: sched.enabled ? "#4F46E5" : "var(--border)", transition: "background 0.2s",
                  }}>
                    <span style={{
                      position: "absolute", top: 2, left: sched.enabled ? 20 : 2,
                      width: 18, height: 18, borderRadius: 9, background: "#fff",
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </button>
                </div>

                {/* Schedule info */}
                <div className="text-text-muted" style={{ fontSize: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <ClockCountdown size={14} />
                  {scheduleLabel(sched.schedule, sched.frequency, t)}
                  {sched.recipients.to.length > 0 && (
                    <span style={{ marginLeft: 4 }}>
                      — {sched.recipients.to.length} dest.
                    </span>
                  )}
                </div>

                {/* Last run badge */}
                <div style={{ marginBottom: 12 }}>
                  {lr ? (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                      background: lr.status === "success" ? "#16A34A18" : lr.status === "error" ? "#DC262618" : "#64748B18",
                      color: lr.status === "success" ? "#16A34A" : lr.status === "error" ? "#DC2626" : "#64748B",
                    }}>
                      {lr.status === "success" ? <Check size={12} weight="bold" /> : lr.status === "error" ? <X size={12} weight="bold" /> : null}
                      {lr.status === "success" ? `${t('srSent')} ${formatLastRun(lr)}` : lr.status === "error" ? `${t('srError')} ${formatLastRun(lr)}` : `${t('srSkipped')} ${formatLastRun(lr)}`}
                      {lr.recipients_count > 0 && ` (${lr.recipients_count})`}
                    </span>
                  ) : (
                    <span className="text-text-muted" style={{ fontSize: 11 }}>
                      {t("scheduleNeverRun")}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                  <button onClick={() => startEditing(sched)} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                    padding: "7px 0", border: "1px solid var(--border)", borderRadius: 8,
                    background: "var(--bg-card)", color: "var(--text-main)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    <Gear size={14} /> {t('configure')}
                  </button>
                  <button onClick={() => handlePreview(sched)} disabled={isActLoading} style={{
                    padding: "7px 10px", border: `1px solid ${color}`, borderRadius: 8,
                    background: "transparent", color, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>
                    <Eye size={14} />
                  </button>
                  <button onClick={() => handleExecute(sched)} disabled={isActLoading} style={{
                    padding: "7px 10px", border: "none", borderRadius: 8,
                    background: color, color: "#fff", fontSize: 12, fontWeight: 600,
                    cursor: isActLoading ? "wait" : "pointer", opacity: isActLoading ? 0.7 : 1,
                  }}>
                    {isActLoading ? <Lightning size={14} /> : <Play size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
