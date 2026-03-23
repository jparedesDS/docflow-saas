import React, { useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import PageHeader from "../components/PageHeader";
import SpotlightCard from "../components/SpotlightCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { useI18n } from "../contexts/I18nContext";
import { TOOLS_CONFIG, TOOL_CATEGORIES } from "../constants/tools";

const TOOL_COMPONENTS = {
  "agenda": lazy(() => import("./Agenda")),
  "devolutions": lazy(() => import("./EmailAssistants")),
  "inbox-ai": lazy(() => import("./InboxAssistant")),
  "claims": lazy(() => import("./Reclamaciones")),
  "docusign": lazy(() => import("./Docusign")),
  "report-center": lazy(() => import("./ReportCenter")),
  "admin": lazy(() => import("./AdminDashboard")),
};

export default function ToolsHub({ onTabChange, activeTool, onToolSelect, user }) {
  const { t } = useI18n();

  useEffect(() => {
    if (activeTool) {
      const tool = TOOLS_CONFIG.find(tc => tc.key === activeTool);
      onTabChange?.(tool ? t(tool.labelKey) : null);
    } else {
      onTabChange?.(null);
    }
  }, [activeTool, onTabChange, t]);

  // Drill-down: render tool component directly
  if (activeTool) {
    const tool = TOOLS_CONFIG.find(tc => tc.key === activeTool);
    if (!tool) { onToolSelect?.(null); return null; }
    const ToolComponent = TOOL_COMPONENTS[tool.key];
    if (!ToolComponent) { onToolSelect?.(null); return null; }

    return (
      <div>
        <button
          onClick={() => onToolSelect?.(null)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "1px solid var(--border)",
            borderRadius: 8, padding: "6px 14px", cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "var(--text-sub)",
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} />
          {t("toolBackToTools")}
        </button>
        <Suspense fallback={<LoadingSpinner />}>
          <ToolComponent
            {...(tool.key === "report-center" && !["admin", "Document Controller"].includes(user?.role)
              ? { mode: "limited" }
              : {})}
          />
        </Suspense>
      </div>
    );
  }

  // Landing page with categories
  let globalIndex = 0;

  return (
    <div>
      <PageHeader title={t("navHerramientas")} description={t("toolsHubDesc")} />

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {TOOL_CATEGORIES.map((cat) => {
          const catTools = TOOLS_CONFIG
            .filter(tc => tc.category === cat.key)
            .filter(tc => !tc.roles || tc.roles.includes(user?.role));
          if (catTools.length === 0) return null;

          return (
            <div key={cat.key}>
              {/* Category header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 3, height: 18, borderRadius: 2,
                  background: "var(--accent)",
                }} />
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--text-muted)",
                }}>
                  {t(cat.labelKey)}
                </span>
              </div>

              {/* Tool cards grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
              }}>
                {catTools.map((tool) => {
                  const Icon = tool.icon;
                  const delay = globalIndex * 0.05;
                  globalIndex++;

                  return (
                    <motion.div
                      key={tool.key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <SpotlightCard
                        style={{ cursor: "pointer" }}
                        onClick={() => onToolSelect?.(tool.key)}
                      >
                        <div style={{
                          display: "flex", alignItems: "center", gap: 14,
                          padding: 18,
                        }}>
                          <div style={{
                            width: 42, height: 42, borderRadius: 10,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            backgroundColor: `${tool.color}18`,
                            flexShrink: 0,
                          }}>
                            <Icon size={22} weight="duotone" color={tool.color} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
                              {t(tool.labelKey)}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                              {t(tool.descKey)}
                            </div>
                          </div>
                          <ArrowRight size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        </div>
                      </SpotlightCard>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
