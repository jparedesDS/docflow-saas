import React, { useState, useEffect } from "react";
import TabBar from "../components/TabBar";
import Agenda from "./Agenda";
import Notifications from "./Notifications";

const TABS = [
  { key: "agenda", label: "Agenda" },
  { key: "notificaciones", label: "Notificaciones" },
];

export default function MySpace({ onTabChange }) {
  const [activeTab, setActiveTab] = useState("agenda");

  useEffect(() => {
    const tab = TABS.find(t => t.key === activeTab);
    onTabChange?.(tab?.label || null);
  }, [activeTab, onTabChange]);

  return (
    <div>
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 20 }}>
        {activeTab === "agenda" && <Agenda />}
        {activeTab === "notificaciones" && <Notifications />}
      </div>
    </div>
  );
}
