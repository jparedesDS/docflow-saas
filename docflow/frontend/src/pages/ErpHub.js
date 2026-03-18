import React, { useState, useEffect, useMemo } from "react";
import TabBar from "../components/TabBar";
import ErpQuery from "./ErpQuery";
import ErpTags from "./ErpTags";
import { useI18n } from "../contexts/I18nContext";

export default function ErpHub({ onTabChange }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("consulta");

  const TABS = useMemo(() => [
    { key: "consulta", label: t('tabConsulta') },
    { key: "tags", label: t('tabTagsInspections') },
  ], [t]);

  useEffect(() => {
    const tab = TABS.find(t => t.key === activeTab);
    onTabChange?.(tab?.label || null);
  }, [activeTab, onTabChange, TABS]);

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 20 }}>
        {activeTab === "consulta" && <ErpQuery />}
        {activeTab === "tags" && <ErpTags />}
      </div>
    </div>
  );
}
