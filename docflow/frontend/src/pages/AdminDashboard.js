import React, { useState, useEffect } from "react";
import { Buildings, Users, ChartBar, ArrowsClockwise } from "@phosphor-icons/react";
import api from "../services/api";
import PageHeader from "../components/PageHeader";

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
  };

  const handleImpersonate = async (tenantId) => {
    try {
      const { data } = await api.post("/admin/impersonate", { tenant_id: tenantId });
      localStorage.setItem("docflow_token", data.token);
      localStorage.setItem("docflow_refresh_token", data.refresh_token);
      localStorage.setItem("docflow_user", JSON.stringify(data.user));
      window.location.reload();
    } catch {
      // Handle error
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <PageHeader title="Admin Dashboard" />
        <p style={{ color: "#71717A", fontSize: 13 }}>Cargando...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: 28 }}>
        <PageHeader title="Admin Dashboard" />
        <p style={{ color: "#71717A", fontSize: 13 }}>
          Acceso restringido a superadmin.
        </p>
      </div>
    );
  }

  const planColors = {
    free: "#71717A",
    pro: "#4F46E5",
    enterprise: "#D97706",
  };

  return (
    <div style={{ padding: 28 }}>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Gestión global de la plataforma"
      />

      {/* Stats cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {[
          { label: "Tenants activos", value: stats.active_tenants, icon: Buildings, color: "#4F46E5" },
          { label: "Total usuarios", value: stats.total_users, icon: Users, color: "#0D9488" },
          { label: "Total documentos", value: stats.total_documents, icon: ChartBar, color: "#D97706" },
          { label: "Total tenants", value: stats.total_tenants, icon: Buildings, color: "#6366F1" },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-card border border-border"
            style={{ borderRadius: 12, padding: 20 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <card.icon size={20} weight="bold" color={card.color} />
              <span style={{ fontSize: 12, color: "#71717A" }}>{card.label}</span>
            </div>
            <p style={{ fontSize: 28, fontWeight: 700, color: "#FFF", margin: 0 }}>
              {card.value?.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Plans breakdown */}
      {stats.tenants_by_plan && (
        <div
          className="bg-card border border-border"
          style={{ borderRadius: 12, padding: 20, marginBottom: 28 }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#FFF", marginBottom: 12 }}>
            Tenants por plan
          </h3>
          <div style={{ display: "flex", gap: 20 }}>
            {Object.entries(stats.tenants_by_plan).map(([plan, count]) => (
              <div key={plan} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: planColors[plan] || "#71717A",
                  }}
                />
                <span style={{ fontSize: 13, color: "#FFF", fontWeight: 600 }}>
                  {plan}: {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tenants table */}
      <div
        className="bg-card border border-border"
        style={{ borderRadius: 12, overflow: "hidden" }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#FFF", margin: 0 }}>
            Organizaciones
          </h3>
          <button
            onClick={fetchData}
            style={{
              background: "transparent",
              border: "none",
              color: "#71717A",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
            }}
          >
            <ArrowsClockwise size={14} />
            Actualizar
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["ID", "Nombre", "Slug", "Plan", "Usuarios", "Activo", "Creado", "Acciones"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#71717A",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "#A1A1AA" }}>{t.id}</td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "#FFF", fontWeight: 600 }}>
                  {t.name}
                </td>
                <td style={{ padding: "10px 16px", fontSize: 12, color: "#71717A", fontFamily: "monospace" }}>
                  {t.slug}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 4,
                      background: `${planColors[t.plan] || "#71717A"}20`,
                      color: planColors[t.plan] || "#71717A",
                      textTransform: "uppercase",
                    }}
                  >
                    {t.plan}
                  </span>
                </td>
                <td style={{ padding: "10px 16px", fontSize: 13, color: "#FFF" }}>
                  {t.user_count} / {t.max_users === -1 ? "ilim." : t.max_users}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: t.is_active ? "#16A34A" : "#DC2626",
                      display: "inline-block",
                    }}
                  />
                </td>
                <td style={{ padding: "10px 16px", fontSize: 12, color: "#71717A" }}>
                  {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                </td>
                <td style={{ padding: "10px 16px" }}>
                  <button
                    onClick={() => handleImpersonate(t.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 11,
                      color: "#6366F1",
                      cursor: "pointer",
                    }}
                  >
                    Impersonar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminDashboard;
