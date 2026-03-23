import React, { useState, useEffect, useCallback } from "react";
import {
  Buildings, Users, ChartBar, ArrowsClockwise, X,
  CurrencyDollar, MagnifyingGlass, CaretRight,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import api from "../services/api";
import PageHeader from "../components/PageHeader";
import TabBar from "../components/TabBar";
import KpiCard from "../components/ui/KpiCard";
import { useI18n } from "../contexts/I18nContext";
import { useToast } from "../contexts/ToastContext";

const PLAN_COLORS = { free: "#71717A", pro: "#4F46E5", enterprise: "#D97706" };
const PLAN_PRICES = { free: 0, pro: 49, enterprise: 199 };

function AdminDashboard() {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Drawer
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [tenantDetail, setTenantDetail] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Drawer edit state
  const [editPlan, setEditPlan] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editMaxUsers, setEditMaxUsers] = useState(0);
  const [impersonateUser, setImpersonateUser] = useState("");
  const [saving, setSaving] = useState(false);

  const TABS = [
    { key: "overview", label: t("adminTabOverview") },
    { key: "organizations", label: t("adminTabOrganizations") },
    { key: "activity", label: t("adminTabActivity") },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/tenants"),
      ]);
      setStats(statsRes.data);
      setTenants(tenantsRes.data);
    } catch {
      // Not superadmin or feature not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDrawer = async (tenantId) => {
    setSelectedTenantId(tenantId);
    setDrawerLoading(true);
    try {
      const { data } = await api.get(`/admin/tenants/${tenantId}`);
      setTenantDetail(data);
      setEditPlan(data.plan);
      setEditActive(data.is_active);
      setEditMaxUsers(data.max_users);
      setImpersonateUser("");
    } catch {
      showToast(t("adminErrorLoadDetail"), "error");
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedTenantId(null);
    setTenantDetail(null);
  };

  const handleSaveChanges = async () => {
    if (!tenantDetail) return;
    setSaving(true);
    try {
      await api.put(`/admin/tenants/${tenantDetail.id}`, {
        plan: editPlan,
        is_active: editActive,
        max_users: parseInt(editMaxUsers) || 3,
      });
      showToast(t("adminTenantUpdated"), "success");
      closeDrawer();
      fetchData();
    } catch {
      showToast(t("adminErrorUpdate"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleImpersonate = async () => {
    if (!tenantDetail) return;
    try {
      const { data } = await api.post("/admin/impersonate", {
        tenant_id: tenantDetail.id,
        username: impersonateUser || undefined,
      });
      localStorage.setItem("docflow_token", data.token);
      localStorage.setItem("docflow_refresh_token", data.refresh_token);
      localStorage.setItem("docflow_user", JSON.stringify(data.user));
      window.location.reload();
    } catch {
      showToast(t("adminErrorImpersonate"), "error");
    }
  };

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = !filterPlan || t.plan === filterPlan;
    const matchesStatus = filterStatus === "" ||
      (filterStatus === "active" && t.is_active) ||
      (filterStatus === "inactive" && !t.is_active);
    return matchesSearch && matchesPlan && matchesStatus;
  });

  // MRR calculation
  const mrr = stats
    ? Object.entries(stats.tenants_by_plan || {}).reduce(
        (sum, [plan, count]) => sum + (PLAN_PRICES[plan] || 0) * count, 0
      )
    : 0;

  // Chart data
  const chartData = stats?.tenants_by_plan
    ? Object.entries(stats.tenants_by_plan).map(([plan, count]) => ({
        name: plan.charAt(0).toUpperCase() + plan.slice(1),
        value: count,
        color: PLAN_COLORS[plan] || "#71717A",
      }))
    : [];

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <PageHeader title={t("adminTitle")} description={t("adminDesc")} />
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("loading")}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: 28 }}>
        <PageHeader title={t("adminTitle")} description={t("adminDesc")} />
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noAccess")}</p>
      </div>
    );
  }

  const hoveredRowStyle = {
    cursor: "pointer",
    transition: "background 0.15s",
  };

  return (
    <div style={{ padding: 28 }}>
      <PageHeader title={t("adminTitle")} description={t("adminDesc")} />
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} layoutId="admin-tab-indicator" />

      <div style={{ marginTop: 20 }}>
        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
              <KpiCard label={t("adminActiveTenants")} value={stats.active_tenants} color="#4F46E5" icon={Buildings} index={0} />
              <KpiCard label={t("adminTotalUsers")} value={stats.total_users} color="#0D9488" icon={Users} index={1} />
              <KpiCard label={t("adminTotalDocs")} value={stats.total_documents} color="#D97706" icon={ChartBar} index={2} />
              <KpiCard label={t("adminMrr")} value={`$${mrr.toLocaleString()}`} color="#16A34A" icon={CurrencyDollar} index={3} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Donut chart */}
              <div className="bg-card border border-border" style={{ borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: 16 }}>
                  {t("adminTenantsByPlan")}
                </h3>
                {chartData.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ width: 160, height: 160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                          >
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "var(--bg-card)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {chartData.map((d) => (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color }} />
                          <span style={{ fontSize: 13, color: "var(--text-main)", fontWeight: 600 }}>
                            {d.name}: {d.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noData")}</p>
                )}
              </div>

              {/* Recent tenants */}
              <div className="bg-card border border-border" style={{ borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)", marginBottom: 16 }}>
                  {t("adminRecentTenants")}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...tenants]
                    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
                    .slice(0, 5)
                    .map((tenant) => (
                      <div
                        key={tenant.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                          ...hoveredRowStyle,
                        }}
                        onClick={() => { setActiveTab("organizations"); openDrawer(tenant.id); }}
                      >
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>{tenant.name}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{tenant.slug}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                            background: `${PLAN_COLORS[tenant.plan] || "#71717A"}20`,
                            color: PLAN_COLORS[tenant.plan] || "#71717A",
                            textTransform: "uppercase",
                          }}>
                            {tenant.plan}
                          </span>
                          <CaretRight size={14} style={{ color: "var(--text-muted)" }} />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Organizations Tab ── */}
        {activeTab === "organizations" && (
          <div>
            {/* Filters */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                <MagnifyingGlass size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("adminSearchPlaceholder")}
                  className="input-field"
                  style={{ width: "100%", paddingLeft: 30, fontSize: 13 }}
                />
              </div>
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="input-field"
                style={{ fontSize: 12, minWidth: 120 }}
              >
                <option value="">{t("adminAllPlans")}</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field"
                style={{ fontSize: 12, minWidth: 120 }}
              >
                <option value="">{t("adminAllStatuses")}</option>
                <option value="active">{t("active")}</option>
                <option value="inactive">{t("inactive")}</option>
              </select>
              <button
                onClick={fetchData}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 12,
                }}
              >
                <ArrowsClockwise size={14} />
                {t("refresh")}
              </button>
            </div>

            {/* Table */}
            <div className="bg-card border border-border" style={{ borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      t("adminColName"), t("adminColSlug"), t("adminColPlan"),
                      t("adminColUsers"), t("adminColActive"), t("adminColCreated"),
                    ].map((h) => (
                      <th key={h} style={{
                        padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
                        color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
                        borderBottom: "1px solid var(--border)",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                        {t("adminNoTenants")}
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <tr
                        key={tenant.id}
                        onClick={() => openDrawer(tenant.id)}
                        style={{ borderBottom: "1px solid var(--border)", ...hoveredRowStyle }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-main)", fontWeight: 600 }}>
                          {tenant.name}
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {tenant.slug}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4,
                            background: `${PLAN_COLORS[tenant.plan] || "#71717A"}20`,
                            color: PLAN_COLORS[tenant.plan] || "#71717A",
                            textTransform: "uppercase",
                          }}>
                            {tenant.plan}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-main)" }}>
                          {tenant.user_count} / {tenant.max_users === -1 ? "∞" : tenant.max_users}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: tenant.is_active ? "#16A34A" : "#DC2626",
                            display: "inline-block",
                          }} />
                        </td>
                        <td style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                          {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Activity Tab ── */}
        {activeTab === "activity" && <ActivityTab />}
      </div>

      {/* ── Tenant Detail Drawer ── */}
      <AnimatePresence>
        {selectedTenantId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed", inset: 0, zIndex: 49,
                background: "rgba(0,0,0,0.4)",
              }}
              onClick={closeDrawer}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{
                position: "fixed", right: 0, top: 0, bottom: 0,
                width: 480, zIndex: 50,
                background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
                display: "flex", flexDirection: "column",
                overflowY: "auto",
              }}
            >
              {/* Drawer header */}
              <div style={{
                padding: "20px 24px", borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                  {t("adminTenantDetail")}
                </h3>
                <button onClick={closeDrawer} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                  <X size={18} />
                </button>
              </div>

              {drawerLoading ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  {t("loading")}
                </div>
              ) : tenantDetail ? (
                <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* Info */}
                  <div>
                    <h4 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>{tenantDetail.name}</h4>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{tenantDetail.slug}</p>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 4,
                        background: `${PLAN_COLORS[tenantDetail.plan] || "#71717A"}20`,
                        color: PLAN_COLORS[tenantDetail.plan] || "#71717A",
                        textTransform: "uppercase",
                      }}>
                        {tenantDetail.plan}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {tenantDetail.created_at ? new Date(tenantDetail.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </div>

                  {/* Users */}
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>{t("adminUsers")}</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {tenantDetail.users?.map((u) => (
                        <div key={u.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)",
                          opacity: u.is_active ? 1 : 0.5,
                        }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)" }}>{u.name}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{u.username}</span>
                          </div>
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                            background: u.role === "admin" ? "#DC262620" : "#4F46E520",
                            color: u.role === "admin" ? "#DC2626" : "#4F46E5",
                          }}>
                            {u.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Billing */}
                  <div>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>{t("adminBilling")}</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>{t("adminColPlan")}</span>
                        <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{tenantDetail.billing?.plan}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>{t("billingStatus")}</span>
                        <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{tenantDetail.billing?.status}</span>
                      </div>
                      {tenantDetail.billing?.stripe_customer_id && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-muted)" }}>Stripe ID</span>
                          <span style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 11 }}>
                            {tenantDetail.billing.stripe_customer_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Usage */}
                  {tenantDetail.usage && (
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>{t("adminUsage")}</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-muted)" }}>{t("adminApiCalls")}</span>
                          <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{tenantDetail.usage.api_calls ?? 0}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-muted)" }}>{t("adminDocsCreated")}</span>
                          <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{tenantDetail.usage.documents_created ?? 0}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-muted)" }}>{t("adminEmailsSent")}</span>
                          <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{tenantDetail.usage.emails_sent ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>{t("adminActions")}</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {/* Change plan */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 80 }}>{t("adminChangePlan")}</label>
                        <select
                          value={editPlan}
                          onChange={(e) => setEditPlan(e.target.value)}
                          className="input-field"
                          style={{ fontSize: 12, flex: 1 }}
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>

                      {/* Max users */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 80 }}>{t("adminMaxUsers")}</label>
                        <input
                          type="number"
                          value={editMaxUsers}
                          onChange={(e) => setEditMaxUsers(e.target.value)}
                          className="input-field"
                          style={{ fontSize: 12, flex: 1 }}
                          min={-1}
                        />
                      </div>

                      {/* Toggle active */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 80 }}>{t("adminToggleActive")}</label>
                        <button
                          onClick={() => setEditActive(!editActive)}
                          style={{
                            padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                            border: "1px solid var(--border)", cursor: "pointer",
                            background: editActive ? "#16A34A20" : "#DC262620",
                            color: editActive ? "#16A34A" : "#DC2626",
                          }}
                        >
                          {editActive ? t("active") : t("inactive")}
                        </button>
                      </div>

                      {/* Save */}
                      <button
                        onClick={handleSaveChanges}
                        disabled={saving}
                        style={{
                          padding: "8px 20px", borderRadius: 8, border: "none",
                          background: "var(--accent)", color: "#FFF",
                          fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer",
                          opacity: saving ? 0.6 : 1,
                        }}
                      >
                        {saving ? t("loading") : t("adminSaveChanges")}
                      </button>
                    </div>
                  </div>

                  {/* Impersonate */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>{t("adminImpersonateAs")}</h4>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        value={impersonateUser}
                        onChange={(e) => setImpersonateUser(e.target.value)}
                        className="input-field"
                        style={{ fontSize: 12, flex: 1 }}
                      >
                        <option value="">{t("adminSelectUser")}</option>
                        {tenantDetail.users?.filter(u => u.is_active).map((u) => (
                          <option key={u.id} value={u.username}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                      <button
                        onClick={handleImpersonate}
                        style={{
                          padding: "6px 14px", borderRadius: 6,
                          border: "1px solid #6366F1", background: "transparent",
                          color: "#6366F1", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        {t("adminImpersonate")}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActivityTab() {
  const { t } = useI18n();
  const [events, setEvents] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    setLoadingActivity(true);
    api.get("/admin/activity")
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoadingActivity(false));
  }, []);

  const timeAgo = (timestamp) => {
    if (!timestamp) return "";
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} ${t("adminMinutes")} ${t("adminTimeAgo")}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ${t("adminHours")} ${t("adminTimeAgo")}`;
    const days = Math.floor(hours / 24);
    return `${days} ${t("adminDaysAgo")} ${t("adminTimeAgo")}`;
  };

  const EVENT_CONFIG = {
    tenant_created: { color: "#4F46E5", icon: Buildings, label: t("adminEventTenantCreated") },
    user_created: { color: "#0D9488", icon: Users, label: t("adminEventUserCreated") },
    usage_update: { color: "#D97706", icon: ChartBar, label: t("adminEventUsageUpdate") },
  };

  if (loadingActivity) {
    return (
      <div className="bg-card border border-border" style={{ borderRadius: 12, padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("loading")}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-card border border-border" style={{ borderRadius: 12, padding: 40, textAlign: "center" }}>
        <ChartBar size={40} weight="thin" style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14, fontWeight: 600 }}>{t("adminNoActivity")}</p>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>{t("adminActivityDesc")}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border" style={{ borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>{t("adminActivity")}</h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{t("adminActivityDesc")}</p>
      </div>
      <div style={{ maxHeight: 600, overflowY: "auto" }}>
        {events.map((event, i) => {
          const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.usage_update;
          const Icon = config.icon;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 20px",
              borderBottom: i < events.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${config.color}14`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={16} style={{ color: config.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                    background: `${config.color}14`, color: config.color,
                  }}>
                    {config.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {event.tenant_name}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-main)", margin: "2px 0" }}>{event.description}</p>
                {event.metadata && (
                  <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                    {Object.entries(event.metadata).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {k}: <b style={{ color: "var(--text-sub)" }}>{v}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                {timeAgo(event.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AdminDashboard;
