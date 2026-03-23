import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Moon, List as ListIcon, X,
  SignOut, Bell, Gear, CaretDown,
  House, Briefcase, FolderOpen,
  ChartBar, Database, Lightning, CalendarBlank, Toolbox,
} from "@phosphor-icons/react";
import api from "./services/api";
import LoginScreen, { ROLES } from "./components/LoginScreen";
import LoadingSpinner from "./components/LoadingSpinner";
import SearchBar from "./components/SearchBar";
import CommandPalette from "./components/CommandPalette";
import Breadcrumbs from "./components/Breadcrumbs";
import ChatPanel from "./components/ChatPanel";
import TabBar from "./components/TabBar";
import { useTheme } from "./contexts/ThemeContext";
import { useI18n } from "./contexts/I18nContext";
import { useTenant } from "./contexts/TenantContext";
import { timeAgo } from "./utils/dates";
import { TOOLS_CONFIG } from "./constants/tools";

/* ── Lazy-loaded pages ───────────────────────────────── */
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProjectsHub = lazy(() => import("./pages/ProjectsHub"));
const DocumentsHub = lazy(() => import("./pages/DocumentsHub"));
const ReportsHub = lazy(() => import("./pages/ReportsHub"));
const ErpHub = lazy(() => import("./pages/ErpHub"));
const WorkflowsHub = lazy(() => import("./pages/WorkflowsHub"));
const Settings = lazy(() => import("./pages/Settings"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Register = lazy(() => import("./pages/Register"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ToolsHub = lazy(() => import("./pages/ToolsHub"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const MiManana = lazy(() => import("./pages/MiManana"));

/* ── Sidebar navigation items ─────────────────────────────── */

const NAV_ITEMS = [
  { key: "inicio",           icon: House,          labelKey: "navInicio" },
  { key: "proyectos",        icon: Briefcase,      labelKey: "navProyectos" },
  { key: "documentos",       icon: FolderOpen,     labelKey: "navDocumentos" },
  { key: "informes",         icon: ChartBar,       labelKey: "navInformes" },
  { key: "erp",              icon: Database,        labelKey: "navErp" },
  { key: "flujos",           icon: Lightning,       labelKey: "navFlujos" },
  { key: "herramientas",     icon: Toolbox,         labelKey: "navHerramientas" },
];

const SETTINGS_ITEM = { key: "configuracion", icon: Gear, labelKey: "navConfiguracion" };

/* ── Sidebar item component ───────────────────────────────── */

function SidebarItem({ item, active, open, onClick, t, badge, suffix }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      title={!open ? t(item.labelKey) : undefined}
      className="relative w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium"
      style={{
        color: active ? "#F1F5F9" : "#94A3B8",
        backgroundColor: active ? "var(--accent-soft)" : "transparent",
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.15s, color 0.15s",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = "var(--bg-sidebar-hover)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {active && (
        <motion.div
          layoutId="nav-active-indicator"
          className="absolute left-0 top-1 bottom-1 w-1 rounded-full"
          style={{ backgroundColor: "var(--accent)" }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
      )}
      <span style={{ color: active ? "var(--accent)" : undefined }} className="shrink-0 ml-1">
        <Icon size={18} weight={active ? "fill" : "regular"} />
      </span>
      {open && <span className="truncate">{t(item.labelKey)}</span>}
      {suffix}
      {badge > 0 && (
        <span style={{
          marginLeft: "auto", flexShrink: 0,
          background: "#DC2626", color: "#fff",
          borderRadius: 10, fontSize: 9, fontWeight: 700,
          padding: "1px 5px", minWidth: 16, textAlign: "center",
          lineHeight: "14px",
        }}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

/* ── Sidebar Tool Submenu ─────────────────────────────────── */

function SidebarToolSubmenu({ tools, activeTool, open, onToolClick, t }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: "hidden" }}
      >
        <div style={{ paddingTop: 2, paddingBottom: 4 }}>
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.key;
            return (
              <button
                key={tool.key}
                onClick={() => onToolClick(tool.key)}
                title={!open ? t(tool.labelKey) : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: 6,
                  padding: open ? "5px 8px 5px 28px" : "5px 0",
                  justifyContent: open ? "flex-start" : "center",
                  backgroundColor: isActive ? "rgba(99,102,241,0.09)" : "transparent",
                  color: isActive ? "#F1F5F9" : "#94A3B8",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 12,
                  transition: "background-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = "#1A1C28"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? "rgba(99,102,241,0.09)" : "transparent"; }}
              >
                <Icon size={14} weight={isActive ? "fill" : "regular"} style={{ color: tool.color, flexShrink: 0 }} />
                {open && <span className="truncate">{t(tool.labelKey)}</span>}
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Workspace Switcher ───────────────────────────────────── */

function WorkspaceSwitcher({ open }) {
  const tenant = useTenant();
  const initial = (tenant.name || "D")[0].toUpperCase();

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      cursor: "default", userSelect: "none",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: "linear-gradient(135deg, #4F46E5, #6366F1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#FFF", fontSize: 14, fontWeight: 800,
      }}>
        {initial}
      </div>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.2 }}
          style={{ flex: 1, minWidth: 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>{tenant.name || "DocFlow"}</span>
            <CaretDown size={10} style={{ color: "#64748B" }} />
          </div>
          <p style={{ fontSize: 9, color: "#64748B", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
            {tenant.plan || "DocFlow"}
          </p>
        </motion.div>
      )}
    </div>
  );
}

/* ── User panel (dropdown) ────────────────────────────────── */

function UserPanel({ user, roleConfig, onClose }) {
  const { t } = useI18n();
  const handleLogout = () => {
    localStorage.removeItem("docflow_token");
    localStorage.removeItem("docflow_refresh_token");
    localStorage.removeItem("docflow_user");
    window.location.reload();
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-14 right-4 z-50 w-72 rounded-xl shadow-2xl overflow-hidden bg-card border border-border"
      >
        <div className="p-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            backgroundColor: roleConfig.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFF", fontSize: 13, fontWeight: 700,
          }}>
            {user.initials}
          </div>
          <div>
            <p className="text-sm font-bold text-text-main">{user.name}</p>
            <p className="text-xs text-text-muted">{user.role}</p>
          </div>
        </div>
        <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full p-2 rounded-lg transition-colors"
            style={{ border: "1px solid #DC262630", background: "transparent", color: "#DC2626", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            <SignOut size={14} /> {t('appLogout')}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ── Notification panel (dropdown) ────────────────────────── */

const NOTIF_COLORS = {
  reclamacion: "#DB2777",
  exportacion: "#16A34A",
  sistema: "#4F46E5",
};

function NotifPanel({ notifs, onClose, onViewAll }) {
  const { t } = useI18n();
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="card"
        style={{
          position: "fixed", top: 56, right: 16, zIndex: 50,
          width: 360,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{t('appNotifications')}</span>
          <button
            onClick={() => { onViewAll(); onClose(); }}
            style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            {t('appViewAll')}
          </button>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {notifs.length === 0 ? (
            <div className="text-text-muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>
              {t('appNoRecentNotifs')}
            </div>
          ) : (
            notifs.map(n => (
              <div key={n.id} style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex", gap: 10, alignItems: "flex-start",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                  background: NOTIF_COLORS[n.tipo] || "#94A3B8",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="text-text-main" style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {n.titulo}
                  </p>
                  <p className="text-text-muted" style={{ fontSize: 11, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {n.detalle}
                  </p>
                </div>
                <span className="text-text-muted" style={{ fontSize: 10, flexShrink: 0, marginTop: 1 }}>
                  {timeAgo(n.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ── Agenda side panel ────────────────────────────────────── */

function AgendaPanel({ onClose }) {
  const { t } = useI18n();
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="bg-card border-l border-border"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 420, overflowY: "auto",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span className="text-text-main" style={{ fontSize: 14, fontWeight: 700 }}>{t('appAgenda')}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <Suspense fallback={<LoadingSpinner />}>
            <Agenda compact />
          </Suspense>
        </div>
      </motion.div>
    </>
  );
}

/* ── Notifications full page (in panel) ──────────────────── */

function NotificationsPanel({ onClose }) {
  const { t } = useI18n();
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="bg-card border-l border-border"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 480, overflowY: "auto",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span className="text-text-main" style={{ fontSize: 14, fontWeight: 700 }}>{t('appAllNotifications')}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <Suspense fallback={<LoadingSpinner />}>
            <Notifications />
          </Suspense>
        </div>
      </motion.div>
    </>
  );
}

/* ── Main App ─────────────────────────────────────────────── */

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const [activeSection, setActiveSection] = useState("inicio");
  const [inicioTab, setInicioTab] = useState("mi-manana");
  const [activeSubTab, setActiveSubTab] = useState(null);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user] = useState(() => {
    const saved = localStorage.getItem("docflow_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showAgendaPanel, setShowAgendaPanel] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const sseConnected = useRef(false);

  // Request browser notification permission on mount
  useEffect(() => {
    if (!user) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [user]);

  // SSE real-time notifications
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("docflow_token");
    if (!token) return;

    let es;
    try {
      const baseUrl = (api.defaults.baseURL || "").replace(/\/+$/, "");
      es = new EventSource(`${baseUrl}/notifications/stream?token=${encodeURIComponent(token)}`);

      es.onopen = () => { sseConnected.current = true; };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setNotifs(prev => [data, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);

          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(data.titulo || "DocFlow", {
              body: data.detalle || "",
              icon: "/favicon.ico",
            });
          }
        } catch {}
      };

      es.onerror = () => {
        sseConnected.current = false;
        // SSE disconnected — fallback polling will handle it
      };
    } catch {}

    return () => { sseConnected.current = false; if (es) es.close(); };
  }, [user]);

  // Polling fallback for notifications (only when SSE is not connected)
  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      if (sseConnected.current) return; // Skip when SSE is active
      try {
        const res = await api.get("/notifications/?limit=8");
        const data = Array.isArray(res.data) ? res.data : [];
        setNotifs(data);
        const lastSeen = parseInt(localStorage.getItem("notif_last_seen") || "0");
        const unread = data.filter(n => new Date(n.timestamp).getTime() > lastSeen).length;
        setUnreadCount(unread);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const openNotifPanel = () => {
    setShowNotifPanel(v => !v);
    setShowUserPanel(false);
    if (!showNotifPanel) {
      localStorage.setItem("notif_last_seen", Date.now().toString());
      setUnreadCount(0);
    }
  };

  // Reset sub-tab and tools when section changes
  useEffect(() => {
    setActiveSubTab(null);
    if (activeSection !== "herramientas") {
      setToolsExpanded(false);
      setActiveTool(null);
    }
  }, [activeSection]);

  /* ── Keyboard shortcuts: Alt+1..7, Alt+S ── */
  const handleNavigate = useCallback((section) => {
    setActiveSection(section);
    if (section === "herramientas") setToolsExpanded(true);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      // Ctrl+K / Cmd+K — command palette (works even from input fields)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }

      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable) return;

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const keyMap = { "1": "inicio", "2": "proyectos", "3": "documentos", "4": "informes", "5": "erp", "6": "flujos", "7": "herramientas" };
        if (keyMap[e.key]) {
          e.preventDefault();
          handleNavigate(keyMap[e.key]);
        }
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          handleNavigate("configuracion");
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleNavigate]);

  const [showRegister, setShowRegister] = useState(false);

  // Client portal: check for ?portal_token= in URL
  const portalToken = new URLSearchParams(window.location.search).get("portal_token");
  if (portalToken) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <ClientPortal portalToken={portalToken} />
      </Suspense>
    );
  }

  if (!user) {
    if (showRegister) {
      return (
        <Suspense fallback={<LoadingSpinner />}>
          <Register onBack={() => setShowRegister(false)} />
        </Suspense>
      );
    }
    return <LoginScreen onShowRegister={() => setShowRegister(true)} />;
  }

  const roleConfig = ROLES[user.role] || ROLES["Document Controller"];

  /* ── Breadcrumbs ── */
  const activeNavItem = NAV_ITEMS.find(i => i.key === activeSection)
    || (activeSection === "configuracion" ? SETTINGS_ITEM : null);
  const sectionLabel = activeNavItem ? t(activeNavItem.labelKey) : "DocFlow";

  const breadcrumbItems = (() => {
    if (activeSection === "herramientas" && activeTool) {
      const tool = TOOLS_CONFIG.find(tc => tc.key === activeTool);
      return [
        { label: sectionLabel, onClick: () => setActiveTool(null) },
        { label: tool ? t(tool.labelKey) : activeTool },
      ];
    }
    return activeSubTab
      ? [{ label: sectionLabel, onClick: () => setActiveSubTab(null) }, { label: activeSubTab }]
      : [{ label: sectionLabel }];
  })();

  return (
    <div className="min-h-[100dvh] flex text-text-main" style={{ background: "var(--bg-page)" }}>
      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarOpen ? 240 : 64 }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        className="shrink-0 flex flex-col sticky top-0 z-20"
        style={{
          backgroundColor: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-sidebar)",
          height: "100dvh",
        }}
      >
        {/* Workspace switcher + toggle */}
        <div className="h-14 flex items-center gap-3 px-3" style={{ borderBottom: "1px solid var(--border-sidebar)" }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
            style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer" }}
            title={sidebarOpen ? t('appCollapseSidebar') : t('appExpandSidebar')}
          >
            {sidebarOpen ? <X size={18} /> : <ListIcon size={18} />}
          </button>
          <AnimatePresence>
            {sidebarOpen && <WorkspaceSwitcher open={sidebarOpen} />}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map(item => (
            <React.Fragment key={item.key}>
              <SidebarItem
                item={item}
                active={activeSection === item.key}
                open={sidebarOpen}
                onClick={() => {
                  if (item.key === "herramientas") {
                    handleNavigate("herramientas");
                    if (activeSection === "herramientas") setToolsExpanded(prev => !prev);
                  } else {
                    setActiveSection(item.key);
                  }
                }}
                t={t}
                badge={0}
                suffix={item.key === "herramientas" && sidebarOpen ? (
                  <CaretDown size={10} style={{
                    marginLeft: "auto", color: "#64748B",
                    transform: toolsExpanded && activeSection === "herramientas" ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 0.2s ease",
                  }} />
                ) : null}
              />
              {item.key === "herramientas" && activeSection === "herramientas" && toolsExpanded && (
                <SidebarToolSubmenu
                  tools={TOOLS_CONFIG.filter(tc => !tc.roles || tc.roles.includes(user?.role))}
                  activeTool={activeTool}
                  open={sidebarOpen}
                  onToolClick={(key) => { setActiveSection("herramientas"); setActiveTool(key); }}
                  t={t}
                />
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Footer: Settings + user */}
        <div style={{ borderTop: "1px solid var(--border-sidebar)" }}>
          <div className="px-2 pt-2 pb-1">
            <SidebarItem
              item={SETTINGS_ITEM}
              active={activeSection === "configuracion"}
              open={sidebarOpen}
              onClick={() => setActiveSection("configuracion")}
              t={t}
            />
          </div>
          <div className="px-3 pb-3 pt-1 flex items-center gap-3" style={{ borderTop: "1px solid var(--border-sidebar)" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              backgroundColor: roleConfig.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#FFF", fontSize: 10, fontWeight: 700,
            }}>
              {user.initials}
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#F1F5F9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</p>
                <p style={{ fontSize: 9, color: "#64748B" }}>{user.role}</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Topbar — 56px */}
        <header className="h-14 flex items-center justify-between px-6 shrink-0 bg-card"
          style={{ borderBottom: "1px solid var(--border)" }}
          role="banner" aria-label="Top navigation"
        >
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Breadcrumbs items={breadcrumbItems} />
          </motion.div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block" style={{ width: 400 }}>
              <SearchBar
                onNavigate={(item) => {
                  if (item._navSection) {
                    setActiveSection(item._navSection);
                    if (item._tool) { setActiveTool(item._tool); setToolsExpanded(true); }
                  } else if (item["Nº Pedido"]) setActiveSection("documentos");
                }}
              />
            </div>

            {/* Calendar button */}
            <button
              onClick={() => { setShowAgendaPanel(v => !v); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-sub"
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
              title={t('appAgenda')}
            >
              <CalendarBlank size={16} />
            </button>

            <button
              onClick={toggleLang}
              className="h-8 px-3 rounded-lg text-xs font-bold text-text-sub"
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
            >
              {lang === "es" ? "ES" : "EN"}
            </button>

            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-sub"
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Bell */}
            <div style={{ position: "relative" }}>
              <button
                onClick={openNotifPanel}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-sub"
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                <Bell size={16} />
              </button>
              {unreadCount > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 4 }}
                  style={{
                    position: "absolute", top: -4, right: -4,
                    background: "#DC2626", color: "#fff",
                    borderRadius: "50%", fontSize: 9, fontWeight: 700,
                    width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1, pointerEvents: "none",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </div>

            {/* User avatar */}
            <button
              onClick={() => { setShowUserPanel(v => !v); setShowNotifPanel(false); }}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                backgroundColor: roleConfig.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#FFF", fontSize: 11, fontWeight: 700,
                border: "none", cursor: "pointer",
              }}
            >
              {user.initials}
            </button>
          </div>
        </header>

        {/* Panels */}
        <AnimatePresence>
          {showUserPanel && (
            <UserPanel user={user} roleConfig={roleConfig} onClose={() => setShowUserPanel(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showNotifPanel && (
            <NotifPanel
              notifs={notifs}
              onClose={() => setShowNotifPanel(false)}
              onViewAll={() => { setShowNotifPanel(false); setShowAllNotifs(true); }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showAgendaPanel && (
            <AgendaPanel onClose={() => setShowAgendaPanel(false)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showAllNotifs && (
            <NotificationsPanel onClose={() => setShowAllNotifs(false)} />
          )}
        </AnimatePresence>

        {/* Command Palette (Ctrl+K) */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigate={(section) => { setActiveSection(section); setCommandPaletteOpen(false); }}
        />

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto" role="main" aria-live="polite">
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <Suspense fallback={<LoadingSpinner />}>
              {activeSection === "inicio" && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <TabBar
                      tabs={[
                        { key: "mi-manana", label: t("mmMiManana") },
                        { key: "dashboard", label: t("navDashboard") },
                      ]}
                      active={inicioTab}
                      onChange={setInicioTab}
                      layoutId="inicio-tab"
                    />
                  </div>
                  {inicioTab === "mi-manana" && <MiManana onNavigate={setActiveSection} />}
                  {inicioTab === "dashboard" && <Dashboard onNavigate={setActiveSection} />}
                </>
              )}
              {activeSection === "proyectos" && <ProjectsHub canExport={user.role === "Document Controller" || user.role === "admin"} onTabChange={setActiveSubTab} />}
              {activeSection === "documentos" && <DocumentsHub canExport={user.role === "Document Controller" || user.role === "admin"} onTabChange={setActiveSubTab} />}
              {activeSection === "informes" && <ReportsHub onTabChange={setActiveSubTab} />}
              {activeSection === "erp" && <ErpHub onTabChange={setActiveSubTab} />}
              {activeSection === "flujos" && <WorkflowsHub onTabChange={setActiveSubTab} />}
              {activeSection === "herramientas" && <ToolsHub onTabChange={setActiveSubTab} activeTool={activeTool} onToolSelect={setActiveTool} user={user} />}
              {activeSection === "configuracion" && <Settings user={user} onTabChange={setActiveSubTab} />}
              {activeSection === "admin" && <AdminDashboard />}
            </Suspense>
          </div>
        </main>
        <ChatPanel />
      </div>
    </div>
  );
}
