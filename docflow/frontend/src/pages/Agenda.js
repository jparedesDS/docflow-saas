import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, PencilSimple, Trash, MagnifyingGlass,
  CalendarBlank, Clock, MapPin, User, Robot,
  FileText, CheckCircle, ArrowClockwise, ListChecks,
  Check, CaretDown, CaretRight, ArrowsClockwise,
  SunHorizon,
} from "@phosphor-icons/react";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";
import PageHeader from "../components/PageHeader";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Input, { Textarea, Select } from "../components/ui/Input";
import api from "../services/api";
import { formatDate, daysUntil } from "../utils/dates";
import SimpleMarkdown from "../components/SimpleMarkdown";

/* ── Constants ── */

const NOTE_COLORS = [
  { key: "default", bg: "var(--bg-card)", label: "Default" },
  { key: "blue",    bg: "#1E3A5F",        label: "Azul" },
  { key: "green",   bg: "#14532D",        label: "Verde" },
  { key: "amber",   bg: "#451A03",        label: "Ámbar" },
  { key: "rose",    bg: "#4C0519",        label: "Rosa" },
];

/* ── Document status extracted from task description ── */
const DOC_STATUS_COLORS = {
  "sin enviar":   { bg: "#64748B20", fg: "#64748B" },
  "enviado":      { bg: "#4F46E520", fg: "#4F46E5" },
  "aprobado":     { bg: "#16A34A20", fg: "#16A34A" },
  "rechazado":    { bg: "#DC262620", fg: "#DC2626" },
  "com. menores": { bg: "#D9770620", fg: "#D97706" },
  "com. mayores": { bg: "#DB277720", fg: "#DB2777" },
  "comentado":    { bg: "#D9770620", fg: "#D97706" },
};

function extractDocStatus(tarea) {
  const desc = tarea.descripcion || "";
  const match = desc.match(/Estado:\s*(.+?)$/i);
  if (match) {
    const raw = match[1].trim().toLowerCase();
    return { label: match[1].trim() || "Sin Enviar", colors: DOC_STATUS_COLORS[raw] || DOC_STATUS_COLORS["sin enviar"] };
  }
  return null;
}

function extractPedido(tarea) {
  const desc = tarea.descripcion || "";
  const match = desc.match(/Pedido\s+(\S+)/i);
  return match ? match[1] : null;
}

/* ── Helpers ── */

function getEstadoLabels(t) {
  return {
    pendiente: t("agStatusPending") || "Pendiente",
    en_progreso: t("agStatusInProgress") || "En progreso",
    completada: t("agStatusCompleted") || "Completada",
  };
}

function isSameDay(dateStr, refDate) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return (
    d.getFullYear() === refDate.getFullYear() &&
    d.getMonth() === refDate.getMonth() &&
    d.getDate() === refDate.getDate()
  );
}

function isThisWeek(dateStr, today) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const todayCopy = new Date(today);
  todayCopy.setHours(0, 0, 0, 0);
  const dayOfWeek = todayCopy.getDay() || 7; // Monday = 1
  const endOfWeek = new Date(todayCopy);
  endOfWeek.setDate(todayCopy.getDate() + (7 - dayOfWeek));
  return d > todayCopy && d <= endOfWeek;
}

function isNextWeek(dateStr, today) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const todayCopy = new Date(today);
  todayCopy.setHours(0, 0, 0, 0);
  const dayOfWeek = todayCopy.getDay() || 7;
  const startNextWeek = new Date(todayCopy);
  startNextWeek.setDate(todayCopy.getDate() + (8 - dayOfWeek));
  const endNextWeek = new Date(startNextWeek);
  endNextWeek.setDate(startNextWeek.getDate() + 6);
  return d >= startNextWeek && d <= endNextWeek;
}

function formatDateLong(date) {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `${days[date.getDay()]}, ${date.getDate()} de ${months[date.getMonth()]}`;
}

const STATUS_URGENCY = { "rechazado": 0, "com. mayores": 1, "comentado": 2, "com. menores": 3, "sin enviar": 4, "": 5 };

function sortTasksByUrgency(tasks) {
  return [...tasks].sort((a, b) => {
    const overA = daysUntil(a.fecha_limite);
    const overB = daysUntil(b.fecha_limite);
    const isOverA = overA !== null && overA < 0 && a.estado !== "completada";
    const isOverB = overB !== null && overB < 0 && b.estado !== "completada";
    if (isOverA && !isOverB) return -1;
    if (!isOverA && isOverB) return 1;
    const sa = extractDocStatus(a);
    const sb = extractDocStatus(b);
    const ua = STATUS_URGENCY[sa?.label?.toLowerCase() || ""] ?? 5;
    const ub = STATUS_URGENCY[sb?.label?.toLowerCase() || ""] ?? 5;
    return ua - ub;
  });
}


/* ══════════════════════════════════════════════════════════════════════
   ACTA VIEW MODAL
   ══════════════════════════════════════════════════════════════════════ */

function ActaView({ reunion, onClose, onCreateTasks, t }) {
  const acta = reunion.acta || "";
  const decisiones = reunion.decisiones || [];
  const acciones = reunion.acciones || [];

  return (
    <Modal title={t("mmMinutes") || "Acta de reunión"} onClose={onClose} maxWidth={720}>
      <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <SimpleMarkdown text={acta} />
        </div>

        {decisiones.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 className="text-text-main" style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              <CheckCircle size={14} weight="bold" style={{ display: "inline", marginRight: 6 }} />
              {t("mmDecisions") || "Decisiones"}
            </h3>
            <div className="card" style={{ padding: 12 }}>
              {decisiones.map((d, i) => (
                <div key={i} className="text-text-sub" style={{ fontSize: 13, padding: "4px 0", borderBottom: i < decisiones.length - 1 ? "1px solid var(--border)" : "none" }}>
                  {i + 1}. {d}
                </div>
              ))}
            </div>
          </div>
        )}

        {acciones.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 className="text-text-main" style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              <ListChecks size={14} weight="bold" style={{ display: "inline", marginRight: 6 }} />
              {t("mmActions") || "Acciones"}
            </h3>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--bg-page)" }}>
                    <th className="text-text-muted" style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Acción</th>
                    <th className="text-text-muted" style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Asignado</th>
                    <th className="text-text-muted" style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fecha</th>
                    <th className="text-text-muted" style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Prioridad</th>
                  </tr>
                </thead>
                <tbody>
                  {acciones.map((a, i) => {
                    const pc = { alta: "#DC2626", media: "#D97706", baja: "#16A34A" }[a.prioridad] || "#6B7280";
                    return (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="text-text-main" style={{ padding: "8px 12px", fontSize: 12 }}>{a.titulo}</td>
                        <td className="text-text-sub" style={{ padding: "8px 12px", fontSize: 12 }}>{a.asignado}</td>
                        <td className="text-text-sub" style={{ padding: "8px 12px", fontSize: 12 }}>{a.fecha_limite}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: pc + "20", color: pc, fontWeight: 700 }}>{a.prioridad}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end mt-4">
        {acciones.length > 0 && (
          <Button icon={ListChecks} onClick={() => onCreateTasks(acciones)}>
            {t("mmCreateTasks") || "Crear tareas"}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>Cerrar</Button>
      </div>
    </Modal>
  );
}


/* ══════════════════════════════════════════════════════════════════════
   TAB: HOY (Today unified view)
   ══════════════════════════════════════════════════════════════════════ */

function TodaySummaryBar({ todayMeetings, pendingTasks, overdueTasks }) {
  const today = new Date();
  const dateStr = formatDateLong(today);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <div className="flex items-center gap-2" style={{ flex: 1, minWidth: 200 }}>
        <SunHorizon size={20} weight="bold" style={{ color: "#D97706" }} />
        <span className="text-text-main" style={{ fontWeight: 700, fontSize: 15 }}>
          {dateStr}
        </span>
      </div>
      <div className="flex items-center gap-4" style={{ flexWrap: "wrap" }}>
        <span className="text-text-sub" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <CalendarBlank size={13} />
          <strong style={{ color: "#4F46E5" }}>{todayMeetings}</strong> reuniones
        </span>
        <span className="text-text-sub" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <ListChecks size={13} />
          <strong style={{ color: "#D97706" }}>{pendingTasks}</strong> pendientes
        </span>
        {overdueTasks > 0 && (
          <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, color: "#DC2626" }}>
            <Clock size={13} />
            <strong>{overdueTasks}</strong> vencidas
          </span>
        )}
      </div>
    </div>
  );
}

function TodayTimeline({ meetings, onNavigateToMeeting }) {
  if (meetings.length === 0) {
    return (
      <div className="text-text-muted" style={{ fontSize: 13, padding: "16px 0", textAlign: "center" }}>
        <CalendarBlank size={24} weight="thin" style={{ display: "inline-block", marginBottom: 4 }} />
        <div>Sin reuniones hoy</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {meetings.map((m, i) => (
        <div
          key={m.id}
          onClick={() => onNavigateToMeeting(m)}
          style={{
            display: "flex",
            gap: 12,
            cursor: "pointer",
            padding: "10px 0",
            borderBottom: i < meetings.length - 1 ? "1px solid var(--border)" : "none",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-page)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          {/* Time column */}
          <div style={{ width: 52, flexShrink: 0, textAlign: "right", paddingRight: 12, position: "relative" }}>
            <span className="text-text-muted" style={{ fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
              {m.hora_inicio || "--:--"}
            </span>
            {/* Vertical line */}
            <div style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 2,
              background: "#4F46E5",
              borderRadius: 1,
            }} />
            {/* Dot */}
            <div style={{
              position: "absolute",
              right: -3,
              top: 14,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#4F46E5",
              border: "2px solid var(--bg-card)",
            }} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="text-text-main" style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
              {m.titulo}
            </p>
            <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 3 }}>
              {m.hora_fin && (
                <span className="text-text-muted" style={{ fontSize: 11 }}>
                  {m.hora_inicio} - {m.hora_fin}
                </span>
              )}
              {m.ubicacion && (
                <span className="text-text-muted" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={10} /> {m.ubicacion}
                </span>
              )}
              {m.asistentes?.length > 0 && (
                <span className="text-text-muted" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                  <User size={10} /> {m.asistentes.length} asistentes
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TodayTaskChecklist({ tasks, onToggle }) {
  if (tasks.length === 0) {
    return (
      <div className="text-text-muted" style={{ fontSize: 13, padding: "16px 0", textAlign: "center" }}>
        <Check size={24} weight="thin" style={{ display: "inline-block", marginBottom: 4 }} />
        <div>Todo completado</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {tasks.map((task, i) => {
        const docStatus = extractDocStatus(task);
        const pedido = extractPedido(task);
        const days = daysUntil(task.fecha_limite);
        const overdue = days !== null && days < 0 && task.estado !== "completada";
        const completed = task.estado === "completada";

        return (
          <div
            key={task.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 4px",
              borderBottom: i < tasks.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            {/* Checkbox */}
            <button
              onClick={() => onToggle(task)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                border: completed ? "none" : "2px solid var(--border)",
                background: completed ? "#16A34A" : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              {completed && <Check size={12} weight="bold" style={{ color: "#FFF" }} />}
            </button>

            {/* Title */}
            <span
              className="text-text-main"
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: completed ? "line-through" : "none",
                opacity: completed ? 0.5 : 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.titulo}
            </span>

            {/* Document status badge (reason why it's pending) */}
            {docStatus && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: docStatus.colors.bg,
                color: docStatus.colors.fg,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}>
                {docStatus.label}
              </span>
            )}

            {/* Pedido */}
            {pedido && (
              <span className="text-text-muted" style={{ fontSize: 10, flexShrink: 0, whiteSpace: "nowrap" }}>
                {pedido}
              </span>
            )}

            {/* Due date */}
            {task.fecha_limite && (
              <span style={{
                fontSize: 11,
                color: overdue ? "#DC2626" : "var(--text-muted)",
                fontWeight: overdue ? 600 : 400,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}>
                {formatDate(task.fecha_limite)}
                {overdue && " · Vencida"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuickAddTask({ onAdd }) {
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim() || adding) return;
    setAdding(true);
    try {
      await onAdd(value.trim());
      setValue("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          transition: "border-color 0.15s",
        }}
      >
        <Plus size={16} weight="bold" style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Añadir tarea rápida..."
          disabled={adding}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 13,
            color: "var(--text-main)",
            fontFamily: "Inter, sans-serif",
          }}
        />
        {value.trim() && (
          <span className="text-text-muted" style={{ fontSize: 10, flexShrink: 0 }}>
            ↵ Enter
          </span>
        )}
      </div>
    </form>
  );
}

function TabHoy({ tareas, reuniones, owner, onSetTab, onToggleTask, onQuickAddTask, compact }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayMeetings = useMemo(() => {
    return reuniones
      .filter(r => isSameDay(r.fecha, today))
      .sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || ""));
  }, [reuniones, today]);

  const pendingTasks = useMemo(() => {
    const pending = tareas.filter(t => t.estado !== "completada");
    return sortTasksByUrgency(pending);
  }, [tareas]);

  const overdueTasks = useMemo(() => {
    return tareas.filter(t => {
      const d = daysUntil(t.fecha_limite);
      return d !== null && d < 0 && t.estado !== "completada";
    });
  }, [tareas]);

  const handleNavigateToMeeting = () => {
    onSetTab("reuniones");
  };

  return (
    <div>
      <TodaySummaryBar
        todayMeetings={todayMeetings.length}
        pendingTasks={pendingTasks.length}
        overdueTasks={overdueTasks.length}
      />

      {/* Meetings section */}
      <div style={{ marginBottom: 28 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <CalendarBlank size={16} weight="bold" style={{ color: "#4F46E5" }} />
          <span className="text-text-main" style={{ fontWeight: 700, fontSize: 14 }}>
            Reuniones de hoy
          </span>
          <span className="text-text-muted" style={{ fontSize: 12 }}>({todayMeetings.length})</span>
        </div>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "8px 16px",
          }}
        >
          <TodayTimeline meetings={todayMeetings} onNavigateToMeeting={handleNavigateToMeeting} />
        </div>
      </div>

      {/* Tasks section */}
      <div>
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <ListChecks size={16} weight="bold" style={{ color: "#D97706" }} />
          <span className="text-text-main" style={{ fontWeight: 700, fontSize: 14 }}>
            Tareas pendientes
          </span>
          <span className="text-text-muted" style={{ fontSize: 12 }}>({pendingTasks.length})</span>
        </div>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "8px 16px",
          }}
        >
          <TodayTaskChecklist tasks={pendingTasks} onToggle={onToggleTask} />
        </div>
        <QuickAddTask onAdd={onQuickAddTask} />
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════
   TAB: TAREAS (List view — simplified from Kanban)
   ══════════════════════════════════════════════════════════════════════ */

function TareaListItem({ tarea, onEdit, onDelete, onToggle, t }) {
  const docStatus = extractDocStatus(tarea);
  const pedido = extractPedido(tarea);
  const days = daysUntil(tarea.fecha_limite);
  const overdue = days !== null && days < 0 && tarea.estado !== "completada";
  const completed = tarea.estado === "completada";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-page)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(tarea)}
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          border: completed ? "none" : "2px solid var(--border)",
          background: completed ? "#16A34A" : "transparent",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
          transition: "all 0.15s",
        }}
      >
        {completed && <Check size={12} weight="bold" style={{ color: "#FFF" }} />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-start gap-2">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-text-main"
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: completed ? "line-through" : "none",
                  opacity: completed ? 0.5 : 1,
                }}
              >
                {tarea.titulo}
              </span>
              {tarea.auto_generated && (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: "#7C3AED20",
                  color: "#A78BFA",
                }}>
                  <Robot size={9} /> Auto · Excel
                </span>
              )}
            </div>
            {tarea.descripcion && (
              <p className="text-text-muted" style={{
                fontSize: 11,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 400,
              }}>
                {tarea.descripcion}
              </p>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 4 }}>
          {/* Document status badge */}
          {docStatus && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: docStatus.colors.bg, color: docStatus.colors.fg }}>
              {docStatus.label}
            </span>
          )}

          {/* Pedido */}
          {pedido && (
            <span className="text-text-muted" style={{ fontSize: 10 }}>Pedido {pedido}</span>
          )}

          {tarea.fecha_limite && (
            <span style={{
              fontSize: 10,
              color: overdue ? "#DC2626" : "var(--text-muted)",
              fontWeight: overdue ? 600 : 400,
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}>
              <CalendarBlank size={10} />
              {formatDate(tarea.fecha_limite)}
              {overdue && " · Vencida"}
            </span>
          )}

          {tarea.asignado && (
            <span className="text-text-muted" style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
              <User size={10} /> {tarea.asignado}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1" style={{ flexShrink: 0, marginTop: 1 }}>
        <button onClick={() => onEdit(tarea)} className="btn-ghost" style={{ padding: 3 }}>
          <PencilSimple size={13} />
        </button>
        <button onClick={() => onDelete(tarea.id)} className="btn-ghost" style={{ padding: 3, color: "#DC2626" }}>
          <Trash size={13} />
        </button>
      </div>
    </motion.div>
  );
}

function TaskSection({ title, tasks, count, defaultOpen = true, color, onEdit, onDelete, onToggle, t }) {
  const [open, setOpen] = useState(defaultOpen);

  if (tasks.length === 0 && defaultOpen) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "6px 0",
          width: "100%",
        }}
      >
        {open ? <CaretDown size={12} style={{ color: "var(--text-muted)" }} /> : <CaretRight size={12} style={{ color: "var(--text-muted)" }} />}
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span className="text-text-sub" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </span>
        <span className="text-text-muted" style={{ fontSize: 11, marginLeft: 4 }}>
          {count}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {tasks.map(tr => (
                <TareaListItem key={tr.id} tarea={tr} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} t={t} />
              ))}
              {tasks.length === 0 && (
                <div className="text-text-muted" style={{ fontSize: 12, padding: "20px 0", textAlign: "center" }}>
                  Sin tareas
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TareaModal({ tarea, onClose, onSaved, owner }) {
  const [form, setForm] = useState({
    titulo: tarea?.titulo || "",
    descripcion: tarea?.descripcion || "",
    estado: tarea?.estado || "pendiente",
    fecha_limite: tarea?.fecha_limite || "",
    asignado: tarea?.asignado || owner || "",
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    const payload = { ...form, titulo: form.titulo.trim() };
    try {
      const res = tarea
        ? await api.put(`/agenda/tareas/${tarea.id}`, payload)
        : await api.post("/agenda/tareas", payload, { params: { owner } });
      onSaved(res.data, !!tarea);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={tarea ? "Editar tarea" : "Nueva tarea"} onClose={onClose}>
      <Input label="Título" value={form.titulo} onChange={set("titulo")} placeholder="Descripción breve" className="mb-3.5" />
      <Textarea label="Descripción" value={form.descripcion} onChange={set("descripcion")} className="mb-3.5" />
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <Select label="Estado" value={form.estado} onChange={set("estado")}>
          <option value="pendiente">Pendiente</option>
          <option value="en_progreso">En Progreso</option>
          <option value="completada">Completada</option>
        </Select>
        <Input label="Fecha límite" type="date" value={form.fecha_limite} onChange={set("fecha_limite")} />
        <Input label="Asignado" value={form.asignado} onChange={set("asignado")} placeholder="Nombre o iniciales" />
      </div>
      <div className="flex gap-2 justify-end mt-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!form.titulo.trim()}>Guardar</Button>
      </div>
    </Modal>
  );
}

function TabTareas({ tareas, setTareas, owner, t, compact, onToggleTask }) {
  const { showToast } = useToast();
  const [modal, setModal] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const syncTasks = async () => {
    setSyncing(true);
    try {
      await api.post("/agenda/tareas/sync", null, { params: { owner } });
      const res = await api.get("/agenda/tareas", { params: { owner } });
      setTareas(res.data);
      showToast("Tareas sincronizadas", "success");
    } catch {
      showToast("Error al sincronizar", "error");
    } finally {
      setSyncing(false);
    }
  };

  const pendientes = sortTasksByUrgency(tareas.filter(tr => tr.estado === "pendiente"));
  const enProgreso = sortTasksByUrgency(tareas.filter(tr => tr.estado === "en_progreso"));
  const completadas = tareas.filter(tr => tr.estado === "completada").slice(0, 10);

  const handleSaved = (result, isEdit) => {
    setTareas(prev => isEdit ? prev.map(tr => tr.id === result.id ? result : tr) : [result, ...prev]);
    setModal(null);
  };

  const handleDelete = async (id) => {
    await api.delete(`/agenda/tareas/${id}`);
    setTareas(prev => prev.filter(tr => tr.id !== id));
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex gap-2.5 mb-5 flex-wrap items-center">
        <div className="flex-1" />
        <Button icon={ArrowsClockwise} variant="secondary" size="sm" onClick={syncTasks} loading={syncing}>
          Sincronizar
        </Button>
        <Button icon={Plus} onClick={() => setModal("new")}>Nueva tarea</Button>
      </div>

      {/* Grouped list */}
      <TaskSection
        title={getEstadoLabels(t).pendiente}
        tasks={pendientes}
        count={pendientes.length}
        color="#6B7280"
        defaultOpen={true}
        onEdit={setModal}
        onDelete={handleDelete}
        onToggle={onToggleTask}
        t={t}
      />

      <TaskSection
        title={getEstadoLabels(t).en_progreso}
        tasks={enProgreso}
        count={enProgreso.length}
        color="#D97706"
        defaultOpen={true}
        onEdit={setModal}
        onDelete={handleDelete}
        onToggle={onToggleTask}
        t={t}
      />

      <TaskSection
        title={getEstadoLabels(t).completada}
        tasks={completadas}
        count={completadas.length}
        color="#16A34A"
        defaultOpen={false}
        onEdit={setModal}
        onDelete={handleDelete}
        onToggle={onToggleTask}
        t={t}
      />

      <AnimatePresence>
        {modal && <TareaModal tarea={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={handleSaved} owner={owner} />}
      </AnimatePresence>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════
   TAB: REUNIONES (grouped by date proximity)
   ══════════════════════════════════════════════════════════════════════ */

function ReunionCard({ reunion, onEdit, onDelete, onViewActa, t, compact: isCompact }) {
  const days = daysUntil(reunion.fecha);
  const badge = days === 0 ? { label: t("agToday") || "Hoy", color: "#16A34A" }
    : days === 1 ? { label: t("agTomorrow") || "Mañana", color: "#D97706" }
    : days !== null && days > 0 ? { label: (t("agInDays") || "En {n} días").replace("{n}", days), color: "#3B82F6" }
    : null;
  const hasActa = !!reunion.acta;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div className="flex justify-between items-start gap-2" style={{ marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-text-main" style={{ fontWeight: 700, fontSize: 13 }}>{reunion.titulo}</p>
            {badge && (
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: badge.color + "25", color: badge.color, fontWeight: 700 }}>
                {badge.label}
              </span>
            )}
            {hasActa && (
              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "#16A34A20", color: "#16A34A", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <FileText size={10} /> Acta
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1" style={{ flexShrink: 0 }}>
          {hasActa && (
            <button onClick={() => onViewActa(reunion)} className="btn-ghost" style={{ padding: 3 }} title="Ver acta">
              <FileText size={13} style={{ color: "#16A34A" }} />
            </button>
          )}
          <button onClick={() => onEdit(reunion)} className="btn-ghost" style={{ padding: 3 }}>
            <PencilSimple size={13} />
          </button>
          <button onClick={() => onDelete(reunion.id)} className="btn-ghost" style={{ padding: 3, color: "#DC2626" }}>
            <Trash size={13} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {reunion.fecha && (
          <span className="flex items-center gap-1 text-text-sub" style={{ fontSize: 11 }}>
            <CalendarBlank size={11} />{formatDate(reunion.fecha)}
          </span>
        )}
        {(reunion.hora_inicio || reunion.hora_fin) && (
          <span className="flex items-center gap-1 text-text-sub" style={{ fontSize: 11 }}>
            <Clock size={11} />{reunion.hora_inicio}{reunion.hora_fin ? ` - ${reunion.hora_fin}` : ""}
          </span>
        )}
        {reunion.ubicacion && (
          <span className="flex items-center gap-1 text-text-sub" style={{ fontSize: 11 }}>
            <MapPin size={11} />{reunion.ubicacion}
          </span>
        )}
      </div>

      {reunion.descripcion && (
        <p className="text-text-muted" style={{ fontSize: 12, marginTop: 4 }}>{reunion.descripcion}</p>
      )}
      {reunion.asistentes?.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {reunion.asistentes.map((a, i) => (
            <span key={i} style={{
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 999,
              background: "var(--bg-page)",
              border: "1px solid var(--border)",
              color: "var(--text-sub)",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}>
              <User size={9} />{a}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ReunionGroup({ title, borderColor, meetings, defaultOpen = true, onEdit, onDelete, onViewActa, t }) {
  const [open, setOpen] = useState(defaultOpen);

  if (meetings.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2"
        style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 0", width: "100%" }}
      >
        {open ? <CaretDown size={12} style={{ color: "var(--text-muted)" }} /> : <CaretRight size={12} style={{ color: "var(--text-muted)" }} />}
        {borderColor && <span style={{ width: 8, height: 8, borderRadius: "50%", background: borderColor }} />}
        <span className="text-text-sub" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {title}
        </span>
        <span className="text-text-muted" style={{ fontSize: 11 }}>({meetings.length})</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
              {meetings.map(r => (
                <div key={r.id} style={{ borderLeft: borderColor ? `3px solid ${borderColor}` : "none", paddingLeft: borderColor ? 10 : 0 }}>
                  <ReunionCard reunion={r} onEdit={onEdit} onDelete={onDelete} onViewActa={onViewActa} t={t} />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReunionModal({ reunion, onClose, onSaved, t }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    titulo: reunion?.titulo || "",
    fecha: reunion?.fecha || "",
    hora_inicio: reunion?.hora_inicio || "",
    hora_fin: reunion?.hora_fin || "",
    asistentes: reunion?.asistentes?.join(", ") || "",
    descripcion: reunion?.descripcion || "",
    ubicacion: reunion?.ubicacion || "",
    notas_reunion: reunion?.notas_reunion || "",
    client_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showActa, setShowActa] = useState(!!reunion?.acta);

  const save = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      titulo: form.titulo.trim(),
      asistentes: form.asistentes.split(",").map(a => a.trim()).filter(Boolean),
    };
    delete payload.client_name;
    try {
      const res = reunion
        ? await api.put(`/agenda/reuniones/${reunion.id}`, payload)
        : await api.post("/agenda/reuniones", payload);
      onSaved(res.data, !!reunion);
    } finally { setSaving(false); }
  };

  const generateMinutes = async () => {
    if (!form.notas_reunion.trim()) {
      showToast(t("mmNoNotes") || "Escribe notas de la reunión para generar el acta", "warning");
      return;
    }
    if (!reunion?.id) {
      showToast("Guarda la reunión primero antes de generar el acta", "warning");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post(`/agenda/reuniones/${reunion.id}/generate-minutes`, {
        notes: form.notas_reunion,
        client_name: form.client_name || null,
      });
      onSaved(res.data, true);
      showToast("Acta generada correctamente", "success");
    } catch (err) {
      showToast(err?.response?.data?.detail || "Error generando acta", "error");
    } finally {
      setGenerating(false);
    }
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={reunion ? "Editar reunión" : "Nueva reunión"} onClose={onClose} maxWidth={640}>
      <Input label="Título" value={form.titulo} onChange={set("titulo")} placeholder="Asunto de la reunión" className="mb-3.5" />
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <Input label="Fecha" type="date" value={form.fecha} onChange={set("fecha")} />
        <Input label="Ubicación" value={form.ubicacion} onChange={set("ubicacion")} placeholder="Sala, Teams, ..." />
        <Input label="Hora inicio" type="time" value={form.hora_inicio} onChange={set("hora_inicio")} />
        <Input label="Hora fin" type="time" value={form.hora_fin} onChange={set("hora_fin")} />
      </div>
      <Input label="Asistentes (separados por coma)" value={form.asistentes} onChange={set("asistentes")} placeholder="J. Paredes, L. García, ..." className="mb-3.5" />
      <Textarea label="Descripción" value={form.descripcion} onChange={set("descripcion")} className="mb-3.5" />

      {/* Meeting notes + AI section */}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
        <div className="flex items-center gap-2 mb-2">
          <Robot size={16} weight="bold" style={{ color: "var(--accent)" }} />
          <span className="text-text-main" style={{ fontWeight: 700, fontSize: 13 }}>
            {t("mmNotes") || "Notas de la reunión"}
          </span>
        </div>
        <Textarea
          value={form.notas_reunion}
          onChange={set("notas_reunion")}
          placeholder="Escribe apuntes durante la reunión... La IA los usará para generar el acta formal."
          className="mb-3"
          style={{ minHeight: 120 }}
        />
        <div className="flex gap-2 items-end mb-3">
          <div className="flex-1">
            <Input
              label="Cliente (opcional, para contexto)"
              value={form.client_name}
              onChange={set("client_name")}
              placeholder="Nombre del cliente para incluir datos del proyecto"
            />
          </div>
          <Button
            icon={generating ? ArrowClockwise : Robot}
            onClick={generateMinutes}
            loading={generating}
            disabled={!form.notas_reunion.trim() || !reunion?.id}
            style={{ whiteSpace: "nowrap" }}
          >
            {generating ? (t("mmRegenerating") || "Generando...") : (t("mmGenerateMinutes") || "Generar acta con IA")}
          </Button>
        </div>

        {reunion?.acta && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => setShowActa(!showActa)}
              style={{ fontSize: 12, fontWeight: 600, cursor: "pointer", background: "none", border: "none", color: "var(--accent)" }}
            >
              {showActa ? "Ocultar acta" : "Ver acta generada"}
            </button>
            {showActa && (
              <div className="card" style={{ padding: 12, marginTop: 8, maxHeight: 300, overflowY: "auto" }}>
                <SimpleMarkdown text={reunion.acta} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end mt-4">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!form.titulo.trim()}>Guardar</Button>
      </div>
    </Modal>
  );
}

function TabReuniones({ reuniones, setReuniones, owner, t }) {
  const { showToast } = useToast();
  const [modal, setModal] = useState(null);
  const [actaModal, setActaModal] = useState(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const sorted = useMemo(() => {
    return [...reuniones].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }, [reuniones]);

  /* Group meetings by time proximity */
  const groups = useMemo(() => {
    const hoy = [];
    const estaSemana = [];
    const proximaSemana = [];
    const masAdelante = [];
    const pasadas = [];

    sorted.forEach(r => {
      if (!r.fecha) {
        masAdelante.push(r);
        return;
      }
      const d = new Date(r.fecha);
      d.setHours(0, 0, 0, 0);

      if (isSameDay(r.fecha, today)) {
        hoy.push(r);
      } else if (d < today) {
        pasadas.push(r);
      } else if (isThisWeek(r.fecha, today)) {
        estaSemana.push(r);
      } else if (isNextWeek(r.fecha, today)) {
        proximaSemana.push(r);
      } else {
        masAdelante.push(r);
      }
    });

    // Reverse pasadas so most recent appear first
    pasadas.reverse();

    return { hoy, estaSemana, proximaSemana, masAdelante, pasadas };
  }, [sorted, today]);

  const handleSaved = (result, isEdit) => {
    setReuniones(prev => isEdit ? prev.map(r => r.id === result.id ? result : r) : [result, ...prev]);
    setModal(null);
  };

  const handleDelete = async (id) => {
    await api.delete(`/agenda/reuniones/${id}`);
    setReuniones(prev => prev.filter(r => r.id !== id));
  };

  const handleCreateTasks = async (acciones) => {
    let created = 0;
    for (const accion of acciones) {
      try {
        await api.post("/agenda/tareas", {
          titulo: accion.titulo,
          descripcion: "Acción de reunión",
          prioridad: accion.prioridad || "media",
          estado: "pendiente",
          fecha_limite: accion.fecha_limite !== "Por definir" ? accion.fecha_limite : "",
          asignado: accion.asignado !== "Por asignar" ? accion.asignado : owner,
        }, { params: { owner } });
        created++;
      } catch { /* ignore individual failures */ }
    }
    showToast(`${created} tareas creadas desde el acta`, "success");
    setActaModal(null);
  };

  return (
    <div>
      <div className="flex gap-3 mb-5 items-center flex-wrap">
        <div className="flex-1" />
        <Button icon={Plus} onClick={() => setModal("new")}>Nueva reunión</Button>
      </div>

      <ReunionGroup title="Hoy" borderColor="#16A34A" meetings={groups.hoy} defaultOpen={true} onEdit={setModal} onDelete={handleDelete} onViewActa={setActaModal} t={t} />
      <ReunionGroup title="Esta semana" borderColor="#4F46E5" meetings={groups.estaSemana} defaultOpen={true} onEdit={setModal} onDelete={handleDelete} onViewActa={setActaModal} t={t} />
      <ReunionGroup title="Próxima semana" borderColor="#6B7280" meetings={groups.proximaSemana} defaultOpen={true} onEdit={setModal} onDelete={handleDelete} onViewActa={setActaModal} t={t} />
      <ReunionGroup title="Más adelante" borderColor={null} meetings={groups.masAdelante} defaultOpen={true} onEdit={setModal} onDelete={handleDelete} onViewActa={setActaModal} t={t} />
      <ReunionGroup title="Pasadas" borderColor="#6B728050" meetings={groups.pasadas} defaultOpen={false} onEdit={setModal} onDelete={handleDelete} onViewActa={setActaModal} t={t} />

      {reuniones.length === 0 && (
        <div className="text-text-muted" style={{ fontSize: 13, padding: 60, textAlign: "center" }}>
          <CalendarBlank size={32} weight="thin" style={{ display: "inline-block", marginBottom: 8 }} />
          <div>No hay reuniones programadas.</div>
        </div>
      )}

      <AnimatePresence>
        {modal && <ReunionModal reunion={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={handleSaved} t={t} />}
      </AnimatePresence>

      <AnimatePresence>
        {actaModal && (
          <ActaView
            reunion={actaModal}
            onClose={() => setActaModal(null)}
            onCreateTasks={handleCreateTasks}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════
   TAB: NOTAS (unchanged — grid of colored note cards)
   ══════════════════════════════════════════════════════════════════════ */

function NotaCard({ nota, onEdit, onDelete }) {
  const bg = NOTE_COLORS.find(c => c.key === (nota.color || "default"))?.bg || "var(--bg-card)";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="border border-border rounded-xl"
      style={{
        background: bg, padding: 16,
        display: "flex", flexDirection: "column", gap: 10, minHeight: 140,
      }}
    >
      <div className="flex justify-between items-start gap-2">
        <p className="text-text-main" style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{nota.titulo}</p>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(nota)} className="btn-ghost p-0.5"><PencilSimple size={14} /></button>
          <button onClick={() => onDelete(nota.id)} className="btn-ghost p-0.5 text-red-500"><Trash size={14} /></button>
        </div>
      </div>
      {nota.contenido && (
        <p className="text-text-sub" style={{ fontSize: 13, lineHeight: 1.5, flex: 1, whiteSpace: "pre-wrap" }}>{nota.contenido}</p>
      )}
      {nota.etiquetas?.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {nota.etiquetas.map((e, i) => (
            <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "#3B82F620", color: "#60A5FA", fontWeight: 600 }}>{e}</span>
          ))}
        </div>
      )}
      <p className="text-text-muted" style={{ fontSize: 10 }}>{formatDate(nota.createdAt)}</p>
    </motion.div>
  );
}

function NotaModal({ nota, onClose, onSaved }) {
  const [form, setForm] = useState({
    titulo: nota?.titulo || "",
    contenido: nota?.contenido || "",
    etiquetas: nota?.etiquetas?.join(", ") || "",
    color: nota?.color || "default",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    const payload = {
      titulo: form.titulo.trim(),
      contenido: form.contenido,
      etiquetas: form.etiquetas.split(",").map(e => e.trim()).filter(Boolean),
      color: form.color,
    };
    try {
      const res = nota
        ? await api.put(`/agenda/notas/${nota.id}`, payload)
        : await api.post("/agenda/notas", payload);
      onSaved(res.data, !!nota);
    } finally { setSaving(false); }
  };

  return (
    <Modal title={nota ? "Editar nota" : "Nueva nota"} onClose={onClose}>
      <Input label="Título" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título de la nota" className="mb-3.5" />
      <Textarea label="Contenido" value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))} placeholder="Escribe aquí..." className="mb-3.5" />
      <Input label="Etiquetas (separadas por coma)" value={form.etiquetas} onChange={e => setForm(f => ({ ...f, etiquetas: e.target.value }))} placeholder="importante, reunión, ..." className="mb-3.5" />
      <div className="mb-3.5">
        <label className="block text-text-muted mb-1.5" style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Color</label>
        <div className="flex gap-2">
          {NOTE_COLORS.map(c => (
            <button key={c.key} onClick={() => setForm(f => ({ ...f, color: c.key }))}
              className="rounded-lg"
              style={{
                width: 28, height: 28, background: c.bg,
                border: form.color === c.key ? "2px solid var(--accent)" : "1px solid var(--border)",
                cursor: "pointer",
              }} title={c.label}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-end mt-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!form.titulo.trim()}>Guardar</Button>
      </div>
    </Modal>
  );
}

function TabNotas({ compact }) {
  const [notas, setNotas] = useState([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => { api.get("/agenda/notas").then(r => setNotas(r.data)).catch(() => {}); }, []);

  const filtered = notas.filter(n =>
    n.titulo?.toLowerCase().includes(search.toLowerCase()) ||
    n.contenido?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaved = (result, isEdit) => {
    setNotas(prev => isEdit ? prev.map(n => n.id === result.id ? result : n) : [result, ...prev]);
    setModal(null);
  };
  const handleDelete = async (id) => {
    await api.delete(`/agenda/notas/${id}`);
    setNotas(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div>
      <div className="flex gap-3 mb-5 items-center">
        <div className="flex-1">
          <Input icon={MagnifyingGlass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar notas..." />
        </div>
        <Button icon={Plus} onClick={() => setModal("new")}>Nueva nota</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-text-muted" style={{ padding: 60 }}>Sin notas. Crea la primera.</div>
      ) : (
        <motion.div layout style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          <AnimatePresence>
            {filtered.map(nota => (
              <NotaCard key={nota.id} nota={nota} onEdit={setModal} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {modal && (
          <NotaModal nota={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={handleSaved} />
        )}
      </AnimatePresence>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════════════════════════════ */

function getTabs(t) {
  return [
    { key: "hoy",       label: "Hoy" },
    { key: "tareas",    label: t("agTasks") || "Tareas" },
    { key: "reuniones", label: t("agMeetings") || "Reuniones" },
    { key: "notas",     label: t("agNotes") || "Notas" },
  ];
}

export default function Agenda({ compact = false }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [tab, setTab] = useState("hoy");

  /* User info from localStorage */
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("docflow_user")) || { initials: "JP" }; }
    catch { return { initials: "JP" }; }
  }, []);

  /* ── Shared state: tareas and reuniones loaded once at top level ── */
  const [tareas, setTareas] = useState([]);
  const [reuniones, setReuniones] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user.initials) return;
    setLoading(true);
    try {
      const [tareasRes, reunionesRes] = await Promise.all([
        api.get("/agenda/tareas", { params: { owner: user.initials } }),
        api.get("/agenda/reuniones", { params: { owner: user.initials } }),
      ]);
      setTareas(tareasRes.data);
      setReuniones(reunionesRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [user.initials]);

  /* Initial sync + load */
  useEffect(() => {
    if (!user.initials) return;
    // Sync tasks from Excel then load everything
    api.post("/agenda/tareas/sync", null, { params: { owner: user.initials } })
      .catch(() => {})
      .finally(() => { loadData(); });
  }, [user.initials, loadData]);

  /* ── Toggle task completion (shared by Hoy and Tareas tabs) ── */
  const handleToggleTask = useCallback(async (task) => {
    const newEstado = task.estado === "completada" ? "pendiente" : "completada";
    try {
      const res = await api.put(`/agenda/tareas/${task.id}`, { estado: newEstado });
      setTareas(prev => prev.map(tr => tr.id === task.id ? res.data : tr));
    } catch {
      showToast("Error al actualizar tarea", "error");
    }
  }, [showToast]);

  /* ── Quick add task from Hoy tab ── */
  const handleQuickAddTask = useCallback(async (titulo) => {
    try {
      const res = await api.post("/agenda/tareas", {
        titulo,
        prioridad: "media",
        estado: "pendiente",
        asignado: user.initials,
      }, { params: { owner: user.initials } });
      setTareas(prev => [res.data, ...prev]);
      showToast("Tarea creada", "success");
    } catch {
      showToast("Error al crear tarea", "error");
    }
  }, [user.initials, showToast]);

  return (
    <div>
      {!compact && <PageHeader title={t("agenda") || "Agenda"} subtitle="Tu espacio personal de productividad" />}

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {getTabs(t).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: "none",
              border: "none",
              borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === key ? "var(--accent)" : "var(--text-muted)",
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-text-muted" style={{ fontSize: 13, padding: 40, textAlign: "center" }}>
          Cargando...
        </div>
      )}

      {/* Tab content with transitions */}
      {!loading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "hoy" && (
              <TabHoy
                tareas={tareas}
                reuniones={reuniones}
                owner={user.initials}
                onSetTab={setTab}
                onToggleTask={handleToggleTask}
                onQuickAddTask={handleQuickAddTask}
                compact={compact}
              />
            )}
            {tab === "tareas" && (
              <TabTareas
                tareas={tareas}
                setTareas={setTareas}
                owner={user.initials}
                t={t}
                compact={compact}
                onToggleTask={handleToggleTask}
              />
            )}
            {tab === "reuniones" && (
              <TabReuniones
                reuniones={reuniones}
                setReuniones={setReuniones}
                owner={user.initials}
                t={t}
              />
            )}
            {tab === "notas" && <TabNotas compact={compact} />}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
