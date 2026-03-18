import React, { createContext, useContext, useState } from "react";
import { translations } from "../translations";

const I18nContext = createContext();

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("docflow_lang") || "es");

  const toggleLang = () => {
    setLang(l => {
      const next = l === "es" ? "en" : "es";
      localStorage.setItem("docflow_lang", next);
      return next;
    });
  };

  const t = (key) => translations[lang]?.[key] || translations["es"]?.[key] || key;

  return (
    <I18nContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
