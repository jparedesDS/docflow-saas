import React, { useState, useEffect, useMemo } from "react";
import TabBar from "../components/TabBar";
import Tracking from "./Tracking";
import Documents from "./Documents";
import { useI18n } from "../contexts/I18nContext";

export default function DocumentsHub({ canExport = false, onTabChange }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("registro");

  const TABS = useMemo(() => [
    { key: "registro", label: t('tabRegistro') },
    { key: "tablero", label: t('tabTablero') },
  ], [t]);

  useEffect(() => {
    const tab = TABS.find(t => t.key === activeTab);
    onTabChange?.(tab?.label || null);
  }, [activeTab, onTabChange, TABS]);

  return (
    <div>
      <TabBar
        tabs={TABS}
        active={activeTab}
        onChange={setActiveTab}
        layoutId="documents-hub-tab"
      />
      <div style={{ marginTop: 20 }}>
        {activeTab === "registro" && <Documents />}
        {activeTab === "tablero" && <Tracking />}
      </div>
    </div>
  );
}
