import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const DEFAULT_TENANT = {
  id: null,
  name: "",
  slug: "",
  plan: "free",
  logo_url: null,
  maxUsers: 3,
  features: {
    workflows: false,
    ai: false,
    custom_reports: false,
    email_parsing: true,
    claims: true,
    docusign: false,
    scheduled_reports: false,
    api_access: false,
  },
  limits: {
    max_users: 3,
    max_documents: 500,
    max_api_calls_per_month: 5000,
  },
  loading: true,
};

const TenantContext = createContext(DEFAULT_TENANT);

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(DEFAULT_TENANT);

  const fetchTenant = useCallback(async () => {
    const token = localStorage.getItem("docflow_token");
    if (!token) {
      setTenant({ ...DEFAULT_TENANT, loading: false });
      return;
    }

    try {
      const { data } = await api.get("/tenants/me");
      setTenant({
        id: data.id,
        name: data.name,
        slug: data.slug,
        plan: data.plan,
        logo_url: data.logo_url,
        maxUsers: data.max_users,
        features: data.features || DEFAULT_TENANT.features,
        limits: data.limits || DEFAULT_TENANT.limits,
        loading: false,
      });
    } catch {
      // Fallback for Excel backend or when tenant endpoint not available
      setTenant({
        ...DEFAULT_TENANT,
        id: 1,
        name: "EIPSA",
        slug: "eipsa",
        plan: "enterprise",
        maxUsers: 25,
        features: {
          workflows: true,
          ai: true,
          custom_reports: true,
          email_parsing: true,
          claims: true,
          docusign: true,
          scheduled_reports: true,
          api_access: true,
        },
        limits: {
          max_users: -1,
          max_documents: -1,
          max_api_calls_per_month: -1,
        },
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const value = {
    ...tenant,
    refetch: fetchTenant,
    hasFeature: (feature) => tenant.features?.[feature] ?? false,
    isWithinLimit: (resource, count = 0) => {
      const limit = tenant.limits?.[`max_${resource}`];
      return limit === -1 || limit === undefined || count < limit;
    },
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
