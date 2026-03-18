import React, { useState, useEffect, useMemo } from "react";
import TabBar from "../components/TabBar";
import InboxAssistant from "./InboxAssistant";
import EmailAssistants from "./EmailAssistants";
import Reclamaciones from "./Reclamaciones";
import Docusign from "./Docusign";
import { useI18n } from "../contexts/I18nContext";

export default function Communications({ onTabChange }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("bandeja");

  const TABS = useMemo(() => [
    { key: "bandeja", label: t('tabBandeja') },
    { key: "transmittals", label: t('tabTransmittals') },
    { key: "reclamaciones", label: t('tabReclamaciones') },
    { key: "firmas", label: t('tabFirmas') },
  ], [t]);

  useEffect(() => {
    const tab = TABS.find(t => t.key === activeTab);
    onTabChange?.(tab?.label || null);
  }, [activeTab, onTabChange, TABS]);

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 20 }}>
        {activeTab === "bandeja" && <InboxAssistant />}
        {activeTab === "transmittals" && <EmailAssistants />}
        {activeTab === "reclamaciones" && <Reclamaciones />}
        {activeTab === "firmas" && <Docusign />}
      </div>
    </div>
  );
}
