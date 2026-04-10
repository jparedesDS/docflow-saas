import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Lightning, EnvelopeSimple, Megaphone, ChartLineUp, FlowArrow, ArrowRight, CheckCircle, Plus, Trash, PencilSimple, ToggleLeft, ToggleRight, ChatText, Check, X } from "@phosphor-icons/react";
import TabBar from "../components/TabBar";
import api from "../services/api";
import { useI18n } from "../contexts/I18nContext";
import { useTenant } from "../contexts/TenantContext";
import { useToast } from "../contexts/ToastContext";
import ErrorBanner from "../components/ErrorBanner";
import EmptyState from "../components/EmptyState";
import usePolling from "../hooks/usePolling";

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

/* ── Automatizaciones ────────────────────────────────────────────────────── */

function AutomatizacionesTab() {
  const { t } = useI18n();
  const tenant = useTenant();
  const hasWorkflows = tenant?.hasFeature?.("workflows") ?? false;
  const [polling, setPolling] = useState(null);

  const AUTOMATIONS = useMemo(() => [
    { id: "polling", title: t('wfPollingImap'), description: t('wfPollingDesc'), icon: EnvelopeSimple, color: "#4F46E5", schedule: t('wfEvery15min'), active: true },
    { id: "claims", title: t('wfAutoClaims'), description: t('wfAutoClaimsDesc'), icon: Megaphone, color: "#D97706", schedule: t('wfThursday8'), active: true },
    { id: "reports", title: t('wfPeriodicReports'), description: t('wfPeriodicDesc'), icon: ChartLineUp, color: "#0D9488", schedule: t('wfMondayDay1'), active: true },
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
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${auto.color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={20} style={{ color: auto.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="text-text-main" style={{ fontSize: 14, fontWeight: 700 }}>{auto.title}</p>
                    <p className="text-text-muted" style={{ fontSize: 11 }}>{auto.schedule}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 12, background: "#16A34A18", color: "#16A34A", fontSize: 10, fontWeight: 700 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                    {t('active')}
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

      {/* Custom workflows section */}
      {hasWorkflows ? <CustomWorkflowsSection /> : (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <Lightning size={40} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('wfCustomFlows')}</h3>
          <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 16 }}>{t('wfFeatureUnavailable')}</p>
          <button disabled style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "not-allowed" }}>
            {t('comingSoon')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Custom Workflows Section ────────────────────────────────────────────── */

function CustomWorkflowsSection() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [workflows, setWorkflows] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);

  const fetchWorkflows = useCallback(() => {
    api.get("/workflows/").then(r => setWorkflows(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  const handleToggle = async (wf) => {
    try {
      await api.patch(`/workflows/${wf.id}/toggle`, { enabled: !wf.enabled });
      fetchWorkflows();
    } catch { showToast("Error", "error"); }
  };

  const handleDelete = async (wf) => {
    if (!window.confirm(t('wfDeleteConfirm'))) return;
    try {
      await api.delete(`/workflows/${wf.id}`);
      fetchWorkflows();
    } catch { showToast("Error", "error"); }
  };

  const handleEdit = (wf) => {
    setEditingWorkflow(wf);
    setShowBuilder(true);
  };

  const handleSaved = () => {
    setShowBuilder(false);
    setEditingWorkflow(null);
    fetchWorkflows();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('wfCustomFlows')}</h3>
          <p className="text-text-muted" style={{ fontSize: 13 }}>{t('wfCustomDesc')}</p>
        </div>
        <button onClick={() => { setEditingWorkflow(null); setShowBuilder(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={16} /> {t('wfCreateFlow')}
        </button>
      </div>

      {showBuilder && (
        <WorkflowBuilder workflow={editingWorkflow} onClose={() => { setShowBuilder(false); setEditingWorkflow(null); }} onSaved={handleSaved} />
      )}

      {workflows.length === 0 && !showBuilder ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <Lightning size={40} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p className="text-text-main" style={{ fontSize: 14, fontWeight: 600 }}>{t('wfNoCustomFlows')}</p>
          <p className="text-text-muted" style={{ fontSize: 13 }}>{t('wfNoCustomFlowsDesc')}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {workflows.map(wf => (
            <div key={wf.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p className="text-text-main" style={{ fontSize: 14, fontWeight: 700 }}>{wf.name}</p>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => handleToggle(wf)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    {wf.enabled ? <ToggleRight size={22} weight="fill" style={{ color: "#16A34A" }} /> : <ToggleLeft size={22} style={{ color: "var(--text-muted)" }} />}
                  </button>
                  <button onClick={() => handleEdit(wf)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <PencilSimple size={16} style={{ color: "var(--text-muted)" }} />
                  </button>
                  <button onClick={() => handleDelete(wf)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Trash size={16} style={{ color: "#DC2626" }} />
                  </button>
                </div>
              </div>
              {wf.description && <p className="text-text-sub" style={{ fontSize: 12, marginBottom: 8 }}>{wf.description}</p>}
              <div className="text-text-muted" style={{ fontSize: 11 }}>
                {t('wfTrigger')}: {wf.trigger_type === "document_received" ? t('wfTriggerDocReceived') : wf.trigger_type === "status_changed" ? t('wfTriggerStatusChanged') : t('wfTriggerManual')}
                {" · "}{wf.actions?.length || 0} {t('wfActions').toLowerCase()}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, padding: "3px 8px", borderRadius: 12, background: wf.enabled ? "#16A34A18" : "#64748B18", color: wf.enabled ? "#16A34A" : "#64748B", fontSize: 10, fontWeight: 700, width: "fit-content" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                {wf.enabled ? t('wfEnabled') : t('wfDisabled')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Workflow Builder ────────────────────────────────────────────────────── */

const TRIGGER_OPTIONS = [
  { value: "document_received", labelKey: "wfTriggerDocReceived" },
  { value: "status_changed", labelKey: "wfTriggerStatusChanged" },
  { value: "manual", labelKey: "wfTriggerManual" },
];

const ACTION_TYPES = [
  { value: "notify", labelKey: "wfActionNotify" },
  { value: "create_approval", labelKey: "wfActionCreateApproval" },
  { value: "change_status", labelKey: "wfActionChangeStatus" },
  { value: "send_email", labelKey: "wfActionSendEmail" },
];

function WorkflowBuilder({ workflow, onClose, onSaved }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [name, setName] = useState(workflow?.name || "");
  const [description, setDescription] = useState(workflow?.description || "");
  const [triggerType, setTriggerType] = useState(workflow?.trigger_type || "manual");
  const [conditions, setConditions] = useState(workflow?.conditions || []);
  const [actions, setActions] = useState(workflow?.actions || []);
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  const addCondition = () => setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  const removeCondition = (i) => setConditions(conditions.filter((_, idx) => idx !== i));
  const updateCondition = (i, key, val) => {
    const updated = [...conditions];
    updated[i] = { ...updated[i], [key]: val };
    setConditions(updated);
  };

  const addAction = () => setActions([...actions, { type: "notify", config: {} }]);
  const removeAction = (i) => setActions(actions.filter((_, idx) => idx !== i));
  const updateAction = (i, key, val) => {
    const updated = [...actions];
    updated[i] = { ...updated[i], [key]: val };
    setActions(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = { name, description, trigger_type: triggerType, conditions, actions, enabled };
      if (workflow?.id) {
        await api.put(`/workflows/${workflow.id}`, data);
      } else {
        await api.post("/workflows/", data);
      }
      onSaved();
    } catch {
      showToast("Error", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-page)", color: "var(--text-main)", fontSize: 13 };

  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h4 className="text-text-main" style={{ fontSize: 15, fontWeight: 700 }}>{workflow ? t('wfEditFlow') : t('wfCreateFlow')}</h4>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} className="text-text-muted" /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t('wfFlowName')}</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder={t('wfFlowName')} />
        </div>
        <div>
          <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t('wfTrigger')}</label>
          <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={inputStyle}>
            {TRIGGER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t('wfFlowDescription')}</label>
        <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} placeholder={t('wfFlowDescription')} />
      </div>

      {/* Conditions */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600 }}>{t('wfConditions')}</label>
          <button onClick={addCondition} className="text-text-muted" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={14} /> {t('wfAddCondition')}
          </button>
        </div>
        {conditions.map((cond, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={cond.field} onChange={e => updateCondition(i, "field", e.target.value)} placeholder={t('wfField')} style={{ ...inputStyle, flex: 1 }} />
            <select value={cond.operator} onChange={e => updateCondition(i, "operator", e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              <option value="equals">=</option>
              <option value="not_equals">!=</option>
              <option value="contains">contains</option>
            </select>
            <input value={cond.value} onChange={e => updateCondition(i, "value", e.target.value)} placeholder={t('wfValue')} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => removeCondition(i)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} style={{ color: "#DC2626" }} /></button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600 }}>{t('wfActions')}</label>
          <button onClick={addAction} className="text-text-muted" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={14} /> {t('wfAddAction')}
          </button>
        </div>
        {actions.map((action, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={action.type} onChange={e => updateAction(i, "type", e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              {ACTION_TYPES.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
            </select>
            <button onClick={() => removeAction(i)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={16} style={{ color: "#DC2626" }} /></button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          <span className="text-text-sub" style={{ fontSize: 13 }}>{t('wfEnabled')}</span>
        </label>
        <button onClick={handleSave} disabled={saving || !name.trim()} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving || !name.trim() ? 0.5 : 1 }}>
          {saving ? t('saving') || "..." : t('wfSaveFlow')}
        </button>
      </div>
    </div>
  );
}

/* ── Aprobaciones ────────────────────────────────────────────────────────── */

function AprobacionesTab() {
  const { t } = useI18n();
  const tenant = useTenant();
  const hasWorkflows = tenant?.hasFeature?.("workflows") ?? false;

  const steps = useMemo(() => [
    { label: t('wfReception'), desc: t('wfReceptionDesc'), color: "#4F46E5" },
    { label: t('wfReview'), desc: t('wfReviewDesc'), color: "#0D9488" },
    { label: t('wfApproval'), desc: t('wfApprovalStepDesc'), color: "#D97706" },
    { label: t('wfClosure'), desc: t('wfClosureDesc'), color: "#16A34A" },
  ], [t]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Flow diagram */}
      <div className="card" style={{ padding: 32 }}>
        <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, textAlign: "center" }}>{t('wfApprovalFlow')}</h3>
        <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 32, textAlign: "center" }}>{t('wfApprovalDesc')}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-page)", minWidth: 140 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${step.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle size={18} style={{ color: step.color }} weight="fill" />
                </div>
                <span className="text-text-main" style={{ fontSize: 13, fontWeight: 700 }}>{step.label}</span>
                <span className="text-text-muted" style={{ fontSize: 11, textAlign: "center" }}>{step.desc}</span>
              </div>
              {i < steps.length - 1 && <ArrowRight size={20} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Approvals section */}
      {hasWorkflows ? <ApprovalsSection /> : (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <FlowArrow size={40} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <h3 className="text-text-main" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t('wfCustomApprovals')}</h3>
          <p className="text-text-muted" style={{ fontSize: 13, marginBottom: 16 }}>{t('wfFeatureUnavailable')}</p>
          <button disabled style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "not-allowed" }}>
            {t('comingSoon')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Approvals Section ───────────────────────────────────────────────────── */

function ApprovalsSection() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [approvals, setApprovals] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [showCreate, setShowCreate] = useState(false);
  const [commentModal, setCommentModal] = useState(null); // { id, action }
  const [commentText, setCommentText] = useState("");

  const fetchApprovals = useCallback(() => {
    const params = filter !== "all" ? `?status=${filter}` : "";
    api.get(`/workflows/approvals/${params}`).then(r => setApprovals(r.data)).catch(() => {});
  }, [filter]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  // Auto-refresh approvals every 2 minutes
  usePolling(fetchApprovals, 120000);

  const handleResolve = (id, action) => {
    setCommentModal({ id, action });
    setCommentText("");
  };

  const submitResolve = async () => {
    if (!commentModal) return;
    try {
      await api.post(`/workflows/approvals/${commentModal.id}/${commentModal.action}`, { comment: commentText });
      setCommentModal(null);
      fetchApprovals();
    } catch { showToast("Error", "error"); }
  };

  const handleCreateApproval = async (data) => {
    try {
      await api.post("/workflows/approvals/", data);
      setShowCreate(false);
      fetchApprovals();
    } catch { showToast("Error", "error"); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["pending", "approved", "rejected", "all"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: filter === f ? "#4F46E514" : "transparent", color: filter === f ? "#4F46E5" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {f === "pending" ? t('wfPendingApprovals') : f === "approved" ? t('approved') : f === "rejected" ? t('rechazado') : t('all')}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Plus size={16} /> {t('wfNewApproval')}
        </button>
      </div>

      {showCreate && <CreateApprovalForm onSubmit={handleCreateApproval} onClose={() => setShowCreate(false)} />}

      {approvals.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <FlowArrow size={40} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <p className="text-text-main" style={{ fontSize: 14, fontWeight: 600 }}>{t('wfNoApprovals')}</p>
          <p className="text-text-muted" style={{ fontSize: 13 }}>{t('wfNoApprovalsDesc')}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {approvals.map(req => (
            <div key={req.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p className="text-text-main" style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{req.title}</p>
                  {req.description && <p className="text-text-sub" style={{ fontSize: 12, marginBottom: 8 }}>{req.description}</p>}
                  <div className="text-text-muted" style={{ fontSize: 11, display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <span>{t('wfRequestedBy')}: {req.requested_by}</span>
                    {req.assigned_to && <span>{t('wfAssignedTo')}: {req.assigned_to}</span>}
                    {req.document_ref && <span>{t('wfDocRef')}: {req.document_ref}</span>}
                    {req.due_date && <span>{t('wfDueDate')}: {new Date(req.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 12, background: req.status === "approved" ? "#16A34A18" : req.status === "rejected" ? "#DC262618" : req.status === "pending" ? "#D9770618" : "#64748B18", color: req.status === "approved" ? "#16A34A" : req.status === "rejected" ? "#DC2626" : req.status === "pending" ? "#D97706" : "#64748B", fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
                  {req.status}
                </div>
              </div>

              {/* Comments */}
              {req.comments?.length > 0 && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  {req.comments.map((c, i) => (
                    <div key={i} className="text-text-sub" style={{ fontSize: 11, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{c.by}</span> ({c.action}): {c.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              {req.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <button onClick={() => handleResolve(req.id, "approve")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 8, border: "none", background: "#16A34A", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <Check size={14} /> {t('wfApprove')}
                  </button>
                  <button onClick={() => handleResolve(req.id, "reject")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 8, border: "none", background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    <X size={14} /> {t('wfReject')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Comment/Resolve modal */}
      {commentModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setCommentModal(null)}>
          <div className="card" style={{ padding: 24, width: 400, maxWidth: "90vw" }} onClick={e => e.stopPropagation()}>
            <h4 className="text-text-main" style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              {commentModal.action === "approve" ? t('wfApprove') : t('wfReject')}
            </h4>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder={t('wfComment')} rows={3} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-page)", color: "var(--text-main)", fontSize: 13, resize: "vertical", marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setCommentModal(null)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-main)", fontSize: 13, cursor: "pointer" }}>
                {t('cancel')}
              </button>
              <button onClick={submitResolve} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: commentModal.action === "approve" ? "#16A34A" : "#DC2626", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Create Approval Form ─────────────────────────────────────────────────── */

function CreateApprovalForm({ onSubmit, onClose }) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-page)", color: "var(--text-main)", fontSize: 13 };

  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h4 className="text-text-main" style={{ fontSize: 15, fontWeight: 700 }}>{t('wfNewApproval')}</h4>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={20} className="text-text-muted" /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t('wfApprovalTitle')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t('wfAssignedTo')}</label>
          <input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t('wfFlowDescription')}</label>
        <input value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label className="text-text-sub" style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t('wfDocRef')}</label>
        <input value={documentRef} onChange={e => setDocumentRef(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-main)", fontSize: 13, cursor: "pointer" }}>{t('cancel')}</button>
        <button onClick={() => onSubmit({ title, description, document_ref: documentRef, assigned_to: assignedTo || undefined })} disabled={!title.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !title.trim() ? 0.5 : 1 }}>{t('save')}</button>
      </div>
    </div>
  );
}
