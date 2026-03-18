import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, PencilSimple, Trash, MagnifyingGlass,
  CalendarBlank, Clock, MapPin, User, Robot,
} from "@phosphor-icons/react";
import { useI18n } from "../contexts/I18nContext";
import PageHeader from "../components/PageHeader";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import Input, { Textarea, Select } from "../components/ui/Input";
import api from "../services/api";
import { formatDate } from "../utils/dates";

const NOTE_COLORS = [
  { key: "default", bg: "var(--bg-card)", label: "Default" },
  { key: "blue",    bg: "#1E3A5F",        label: "Azul" },
  { key: "green",   bg: "#14532D",        label: "Verde" },
  { key: "amber",   bg: "#451A03",        label: "Ámbar" },
  { key: "rose",    bg: "#4C0519",        label: "Rosa" },
];

const PRIORIDAD_COLORS = {
  alta:  { bg: "#DC2626", text: "#FFF" },
  media: { bg: "#D97706", text: "#FFF" },
  baja:  { bg: "#16A34A", text: "#FFF" },
};

const ESTADO_COLS = ["pendiente", "en_progreso", "completada"];
function getEstadoLabels(t) {
  return { pendiente: t('agStatusPending'), en_progreso: t('agStatusInProgress'), completada: t('agStatusCompleted') };
}

function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

// ─────────────────────────── TAB NOTAS ───────────────────────────

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

function TabNotas() {
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
        <motion.div layout style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
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

// ─────────────────────────── TAB REUNIONES ───────────────────────────

function ReunionCard({ reunion, onEdit, onDelete, t }) {
  const days = daysFromNow(reunion.fecha);
  const badge = days === 0 ? { label: t('agToday'), color: "#16A34A" }
    : days === 1 ? { label: t('agTomorrow'), color: "#D97706" }
    : days !== null && days > 0 ? { label: t('agInDays').replace('{n}', days), color: "#3B82F6" }
    : null;

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="card p-4"
    >
      <div className="flex justify-between items-start gap-2 mb-2.5">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-text-main" style={{ fontWeight: 700, fontSize: 14 }}>{reunion.titulo}</p>
            {badge && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: badge.color + "30", color: badge.color, fontWeight: 700 }}>{badge.label}</span>}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(reunion)} className="btn-ghost p-0.5"><PencilSimple size={14} /></button>
          <button onClick={() => onDelete(reunion.id)} className="btn-ghost p-0.5 text-red-500"><Trash size={14} /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {reunion.fecha && (
          <span className="flex items-center gap-1 text-text-sub" style={{ fontSize: 11 }}>
            <CalendarBlank size={12} />{formatDate(reunion.fecha)}
          </span>
        )}
        {(reunion.hora_inicio || reunion.hora_fin) && (
          <span className="flex items-center gap-1 text-text-sub" style={{ fontSize: 11 }}>
            <Clock size={12} />{reunion.hora_inicio}{reunion.hora_fin ? ` - ${reunion.hora_fin}` : ""}
          </span>
        )}
        {reunion.ubicacion && (
          <span className="flex items-center gap-1 text-text-sub" style={{ fontSize: 11 }}>
            <MapPin size={12} />{reunion.ubicacion}
          </span>
        )}
      </div>
      {reunion.descripcion && (
        <p className="text-text-muted mt-2" style={{ fontSize: 13 }}>{reunion.descripcion}</p>
      )}
      {reunion.asistentes?.length > 0 && (
        <div className="mt-2 flex gap-1 flex-wrap">
          {reunion.asistentes.map((a, i) => (
            <span key={i} className="bg-page border border-border text-text-sub" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999 }}>
              <User size={9} style={{ display: "inline", marginRight: 3 }} />{a}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ReunionModal({ reunion, onClose, onSaved }) {
  const [form, setForm] = useState({
    titulo: reunion?.titulo || "",
    fecha: reunion?.fecha || "",
    hora_inicio: reunion?.hora_inicio || "",
    hora_fin: reunion?.hora_fin || "",
    asistentes: reunion?.asistentes?.join(", ") || "",
    descripcion: reunion?.descripcion || "",
    ubicacion: reunion?.ubicacion || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      titulo: form.titulo.trim(),
      asistentes: form.asistentes.split(",").map(a => a.trim()).filter(Boolean),
    };
    try {
      const res = reunion
        ? await api.put(`/agenda/reuniones/${reunion.id}`, payload)
        : await api.post("/agenda/reuniones", payload);
      onSaved(res.data, !!reunion);
    } finally { setSaving(false); }
  };

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={reunion ? "Editar reunión" : "Nueva reunión"} onClose={onClose}>
      <Input label="Título" value={form.titulo} onChange={set("titulo")} placeholder="Asunto de la reunión" className="mb-3.5" />
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        <Input label="Fecha" type="date" value={form.fecha} onChange={set("fecha")} />
        <Input label="Ubicación" value={form.ubicacion} onChange={set("ubicacion")} placeholder="Sala, Teams, ..." />
        <Input label="Hora inicio" type="time" value={form.hora_inicio} onChange={set("hora_inicio")} />
        <Input label="Hora fin" type="time" value={form.hora_fin} onChange={set("hora_fin")} />
      </div>
      <Input label="Asistentes (separados por coma)" value={form.asistentes} onChange={set("asistentes")} placeholder="J. Paredes, L. García, ..." className="mb-3.5" />
      <Textarea label="Descripción" value={form.descripcion} onChange={set("descripcion")} className="mb-3.5" />
      <div className="flex gap-2 justify-end mt-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!form.titulo.trim()}>Guardar</Button>
      </div>
    </Modal>
  );
}

function TabReuniones({ owner, t }) {
  const [reuniones, setReuniones] = useState([]);
  const [filtro, setFiltro] = useState("proximas");
  const [modal, setModal] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!owner) return;
    setSyncing(true);
    api.get("/agenda/reuniones", { params: { owner } })
      .then(r => setReuniones(r.data))
      .catch(() => {})
      .finally(() => setSyncing(false));
  }, [owner]);

  const today = new Date(); today.setHours(0,0,0,0);
  const sorted = [...reuniones].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const filtered = sorted.filter(r => {
    if (!r.fecha) return filtro === "proximas";
    const d = new Date(r.fecha); d.setHours(0,0,0,0);
    return filtro === "proximas" ? d >= today : d < today;
  });

  const handleSaved = (result, isEdit) => {
    setReuniones(prev => isEdit ? prev.map(r => r.id === result.id ? result : r) : [result, ...prev]);
    setModal(null);
  };
  const handleDelete = async (id) => {
    await api.delete(`/agenda/reuniones/${id}`);
    setReuniones(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div>
      <div className="flex gap-3 mb-5 items-center flex-wrap">
        {syncing && (
          <span className="text-xs flex items-center gap-1" style={{ color: "#A78BFA" }}>
            <Robot size={12} /> Sincronizando con email...
          </span>
        )}
        <div className="flex gap-1">
          {["proximas", "pasadas"].map(f => (
            <Button key={f} variant={filtro === f ? "primary" : "secondary"} size="sm" onClick={() => setFiltro(f)}>
              {f === "proximas" ? "Próximas" : "Pasadas"}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <Button icon={Plus} onClick={() => setModal("new")}>Nueva reunión</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-text-muted" style={{ padding: 60 }}>
          {filtro === "proximas" ? "No hay reuniones próximas." : "No hay reuniones pasadas."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {filtered.map(r => (
              <ReunionCard key={r.id} reunion={r} onEdit={setModal} onDelete={handleDelete} t={t} />
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {modal && <ReunionModal reunion={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={handleSaved} />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── TAB TAREAS ───────────────────────────

function TareaCard({ tarea, onEdit, onDelete, onChangeEstado, t }) {
  const pc = PRIORIDAD_COLORS[tarea.prioridad] || { bg: "#6B7280", text: "#FFF" };
  const days = daysFromNow(tarea.fecha_limite);
  const overdue = days !== null && days < 0 && tarea.estado !== "completada";

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="card"
      style={{
        borderColor: overdue ? "#DC262640" : undefined,
        padding: 12, marginBottom: 8,
      }}
    >
      <div className="flex justify-between gap-2 items-start">
        <div className="flex-1 flex flex-col gap-1">
          {tarea.auto_generated && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#7C3AED20", color: "#A78BFA", width: "fit-content" }}>
              <Robot size={9} /> Auto · Excel
            </span>
          )}
          <p className="text-text-main" style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{tarea.titulo}</p>
        </div>
        <div className="flex gap-1">
          {!tarea.auto_generated && <button onClick={() => onEdit(tarea)} className="btn-ghost p-0.5"><PencilSimple size={13} /></button>}
          {!tarea.auto_generated && <button onClick={() => onDelete(tarea.id)} className="btn-ghost p-0.5 text-red-500"><Trash size={13} /></button>}
        </div>
      </div>
      {tarea.descripcion && <p className="text-text-muted mt-1" style={{ fontSize: 11 }}>{tarea.descripcion}</p>}
      <div className="flex flex-wrap gap-1.5 mt-2 items-center">
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: pc.bg, color: pc.text, fontWeight: 700 }}>{tarea.prioridad}</span>
        {tarea.asignado && <span className="text-text-muted" style={{ fontSize: 10 }}><User size={9} style={{ display: "inline" }} /> {tarea.asignado}</span>}
        {tarea.fecha_limite && (
          <span style={{ fontSize: 10, color: overdue ? "#DC2626" : "var(--text-muted)" }}>
            <CalendarBlank size={9} style={{ display: "inline" }} /> {formatDate(tarea.fecha_limite)}
            {overdue && " · Vencida"}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex gap-1">
        {ESTADO_COLS.filter(e => e !== tarea.estado).map(e => (
          <Button key={e} variant="secondary" size="sm" onClick={() => onChangeEstado(tarea.id, e)}
            style={{ fontSize: 10, padding: "3px 8px" }}>
            → {getEstadoLabels(t)[e]}
          </Button>
        ))}
      </div>
    </motion.div>
  );
}

function TareaModal({ tarea, onClose, onSaved, owner }) {
  const [form, setForm] = useState({
    titulo: tarea?.titulo || "",
    descripcion: tarea?.descripcion || "",
    prioridad: tarea?.prioridad || "media",
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
        <Select label="Prioridad" value={form.prioridad} onChange={set("prioridad")}>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </Select>
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

function TabTareas({ owner, t }) {
  const [tareas, setTareas] = useState([]);
  const [modal, setModal] = useState(null);
  const [filtroPrioridad, setFiltroPrioridad] = useState("todas");
  const [syncing, setSyncing] = useState(false);

  const loadTareas = useCallback(() => {
    api.get("/agenda/tareas", { params: { owner } }).then(r => setTareas(r.data)).catch(() => {});
  }, [owner]);

  useEffect(() => {
    if (!owner) return;
    setSyncing(true);
    api.post("/agenda/tareas/sync", null, { params: { owner } })
      .catch(() => {})
      .finally(() => { setSyncing(false); loadTareas(); });
  }, [owner, loadTareas]);

  const filtered = tareas.filter(tr =>
    filtroPrioridad === "todas" || tr.prioridad === filtroPrioridad
  );

  const handleSaved = (result, isEdit) => {
    setTareas(prev => isEdit ? prev.map(tr => tr.id === result.id ? result : tr) : [result, ...prev]);
    setModal(null);
  };
  const handleDelete = async (id) => {
    await api.delete(`/agenda/tareas/${id}`);
    setTareas(prev => prev.filter(tr => tr.id !== id));
  };
  const handleChangeEstado = async (id, nuevoEstado) => {
    const res = await api.put(`/agenda/tareas/${id}`, { estado: nuevoEstado });
    setTareas(prev => prev.map(tr => tr.id === id ? res.data : tr));
  };

  return (
    <div>
      <div className="flex gap-2.5 mb-5 flex-wrap items-center">
        <div className="flex gap-1">
          {["todas", "alta", "media", "baja"].map(p => (
            <Button key={p} variant={filtroPrioridad === p ? "primary" : "secondary"} size="sm" onClick={() => setFiltroPrioridad(p)}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
        {syncing && (
          <span className="text-xs flex items-center gap-1" style={{ color: "#A78BFA" }}>
            <Robot size={12} /> Sincronizando con Excel...
          </span>
        )}
        <div className="flex-1" />
        <Button icon={Plus} onClick={() => setModal("new")}>Nueva tarea</Button>
      </div>

      {/* Columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {ESTADO_COLS.map(col => {
          const colTareas = filtered.filter(tr => tr.estado === col);
          const colColors = { pendiente: "#6B7280", en_progreso: "#D97706", completada: "#16A34A" };
          return (
            <div key={col}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: colColors[col] }} />
                <span className="text-text-sub" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {getEstadoLabels(t)[col]}
                </span>
                <span className="ml-auto text-text-muted bg-card border border-border" style={{ fontSize: 11, borderRadius: 999, padding: "1px 7px" }}>
                  {colTareas.length}
                </span>
              </div>
              <div style={{ minHeight: 80 }}>
                <AnimatePresence>
                  {colTareas.map(tr => (
                    <TareaCard key={tr.id} tarea={tr} onEdit={setModal} onDelete={handleDelete} onChangeEstado={handleChangeEstado} t={t} />
                  ))}
                </AnimatePresence>
                {colTareas.length === 0 && (
                  <div className="border border-dashed border-border text-center text-text-muted" style={{ borderRadius: 10, padding: "24px 0", fontSize: 11 }}>
                    Sin tareas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {modal && <TareaModal tarea={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={handleSaved} owner={owner} />}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────── Página principal ───────────────────────────

function getTabs(t) {
  return [
    { key: "tareas",    label: t('agTasks') },
    { key: "notas",     label: t('agNotes') },
    { key: "reuniones", label: t('agMeetings') },
  ];
}

export default function Agenda() {
  const { t } = useI18n();
  const [tab, setTab] = useState("tareas");
  const user = (() => {
    try { return JSON.parse(localStorage.getItem("docflow_user")) || { initials: "JP" }; } catch { return { initials: "JP" }; }
  })();

  return (
    <div>
      <PageHeader title={t("agenda") || "Agenda"} subtitle="Notas, reuniones y tareas del equipo" />

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {getTabs(t).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "none", border: "none",
              borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === key ? "var(--accent)" : "var(--text-muted)",
              marginBottom: -1,
              transition: "color 0.15s",
            }}>
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "notas" && <TabNotas />}
          {tab === "reuniones" && <TabReuniones owner={user.initials} t={t} />}
          {tab === "tareas" && <TabTareas owner={user.initials} t={t} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
