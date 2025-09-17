import React from "react";

export default function DebugTabs({ tab, onChange }) {
  const tabs = [
    { id: "json", label: "Dev: Conversation JSON" },
    { id: "verbose", label: "Dev: Verbose" },
    { id: "clean", label: "User Chat" }
  ];
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={"tab " + (tab === t.id ? "active" : "")}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
