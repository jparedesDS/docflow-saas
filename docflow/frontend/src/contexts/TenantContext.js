import React, { createContext, useContext } from "react";

const TenantContext = createContext({
  name: "EIPSA",
  slug: "eipsa",
  plan: "Enterprise",
  logo: null,
  maxUsers: 25,
  features: {
    workflows: false,
    customReports: false,
    billing: false,
  },
});

export function TenantProvider({ children }) {
  const tenant = {
    name: "EIPSA",
    slug: "eipsa",
    plan: "Enterprise",
    logo: null,
    maxUsers: 25,
    features: {
      workflows: false,
      customReports: false,
      billing: false,
    },
  };

  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
