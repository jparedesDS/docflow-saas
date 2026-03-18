import React, { useState, useEffect, useMemo } from "react";
import { Lightning, EnvelopeSimple, Megaphone, ChartLineUp, FlowArrow, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import TabBar from "../components/TabBar";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";

export default function WorkflowsHub({ onTabChange }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("automatizaciones");

  const TABS = useMemo(() => [
    { key: "automatizaciones", label: t('tabAutomations') },
    { key: "aprobaciones", label: t('tabApprovals') },
  ], [t]);

  useEffect(() => {
    const tab = TABS.find(t => t.key === activeTab);
    onTabChange?.(tab?.label || null);
  }, [activeTab, onTabChange, TABS]);

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="workflows-tab" />
      <div style={{ marginTop: 20 }}>
        {activeTab === "automatizaciones" && <AutomatizacionesTab />}
        {activeTab === "aprobaciones" && <AprobacionesTab />}
      </div>
    </div>
  );
}

function AutomatizacionesTab() {
  const { t } = useI18n();
  const [polling, setPolling] = useState(null);

  const AUTOMATIONS = useMemo(() => [
    {
      id: "polling",
      title: t('wfPollingImap'),
      description: t('wfPollingDesc'),
      icon: EnvelopeSimple,
      color: "#4F46E5",
      schedule: t('wfEvery15min'),
      active: true,
    },
    {
      id: "claims",
      title: t('wfAutoClaims'),
      description: t('wfAutoClaimsDesc'),
      icon: Megaphone,
      color: "#D97706",
      schedule: t('wfThursday8'),
      active: true,
    },
    {
      id: "reports",
      title: t('wfPeriodicReports'),
      description: t('wfPeriodicDesc'),
      icon: ChartLineUp,
      color: "#0D9488",
      schedule: t('wfMondayDay1'),
      active: true,
    },
  ], [t]);

  useEffect(() => {
    api.get("/polling/status").then(r => setPolling(r.data)).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Active automations */}
      <div>
        <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('wfActiveAutomations')}</h3>
        <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 16 }}>{t('wfActiveDesc')}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {AUTOMATIONS.map(auto => {
            const Icon = auto.icon;
            return (
              <div key={auto.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${auto.color}14`, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={20} style={{ color: auto.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="text-text-main" style={{ fontSize: 14, fontWeight: 700 }}>{auto.title}</p>
                    <p className="text-text-muted" style={{ fontSize: 11 }}>{auto.schedule}</p>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 12,
                    background: auto.active ? "#16A34A18" : "#64748B18",
                    color: auto.active ? "#16A34A" : "#64748B",
                    fontSize: 10, fontWeight: 700,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                    {auto.active ? t('active') : t('inactive')}
                  </div>
                </div>
                <p className="text-text-sub" style={{ fontSize: 12, marginBottom: 12 }}>{auto.description}</p>
                {auto.id === "polling" && polling && (
                  <div className="text-text-muted" style={{ fontSize: 11, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                    {t('wfLast')}: {polling.last_run || t('never')} · {polling.emails_found ?? 0} {t('wfEmails')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Coming soon */}
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <Lightning size={40} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
        <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('wfCustomFlows')}</h3>
        <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 16 }}>{t('wfCustomDesc')}</p>
        <button disabled style={{
          padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--bg-hover)", color: "var(--text-muted)",
          fontSize: 13, fontWeight: 600, cursor: "not-allowed",
        }}>
          {t('comingSoon')}
        </button>
      </div>
    </div>
  );
}

function AprobacionesTab() {
  const { t } = useI18n();

  const steps = useMemo(() => [
    { label: t('wfReception'), desc: t('wfReceptionDesc'), color: "#4F46E5" },
    { label: t('wfReview'), desc: t('wfReviewDesc'), color: "#0D9488" },
    { label: t('wfApproval'), desc: t('wfApprovalStepDesc'), color: "#D97706" },
    { label: t('wfClosure'), desc: t('wfClosureDesc'), color: "#16A34A" },
  ], [t]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="card" style={{ padding: 32 }}>
        <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, textAlign: "center" }}>{t('wfApprovalFlow')}</h3>
        <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 32, textAlign: "center" }}>{t('wfApprovalDesc')}</p>

        {/* Flow diagram */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border)",
                background: "var(--bg-page)", minWidth: 140,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: `${step.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <CheckCircle size={18} style={{ color: step.color }} weight="fill" />
                </div>
                <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{step.label}</span>
                <span className="text-text-muted" style={{ fontSize: 11, textAlign: "center" }}>{step.desc}</span>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight size={20} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <FlowArrow size={40} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
        <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('wfCustomApprovals')}</h3>
        <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 16 }}>{t('wfCustomApprovalsDesc')}</p>
        <button disabled style={{
          padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--bg-hover)", color: "var(--text-muted)",
          fontSize: 13, fontWeight: 600, cursor: "not-allowed",
        }}>
          {t('comingSoon')}
        </button>
      </div>
    </div>
  );
}
