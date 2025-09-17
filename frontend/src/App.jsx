import React, { useEffect, useMemo, useRef, useState } from "react";
import ChatPanel from "./components/ChatPanel.jsx";
import ResumePanel from "./components/ResumePanel.jsx";
import DebugTabs from "./components/DebugTabs.jsx";
import ConversationJSON from "./components/ConversationJSON.jsx";
import DevFooter from "./components/DevFooter.jsx";
import VersionsBar from "./components/VersionsBar.jsx";
import { useConversation } from "./state/useConversation.js";
import { botFlow, widgetDefs } from "./lib/widgets.js";
import { listVersions, createVersion, getVersion, renameVersion, saveVersion } from "./api/versions.js";

// Helper to produce "user-MMDDYY-HHMMSS" on client when user types "New +"
const defaultName = () => {
  const pad = (n) => n.toString().padStart(2,'0');
  const d = new Date();
  return `user-${pad(d.getMonth()+1)}${pad(d.getDate())}${d.getFullYear().toString().slice(-2)}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

export default function App() {
  const conv = useConversation();
  const [tab, setTab] = useState("verbose"); // 'json' | 'verbose' | 'clean'
  const [versions, setVersions] = useState([]);
  const [currentVersionId, setCurrentVersionId] = useState(null);
  const loadingRef = useRef(false); // suppress autosave immediately after a load

  // ---- initial load of versions ----
  useEffect(() => {
    (async () => {
      const list = await listVersions();
      if (list.length === 0) {
        const v = await createVersion(); // backend auto-names + default payload
        setVersions([v]);
        setCurrentVersionId(v.id);
        loadingRef.current = true;
        conv.resetTo(v.payload);
      } else {
        setVersions(list);
        setCurrentVersionId(list[0].id);
        loadingRef.current = true;
        const full = await getVersion(list[0].id);
        conv.resetTo(full.payload);
      }
    })().catch(console.error);
  }, []);

  // ---- autosave on state changes (submit/undo/etc.) ----
  const snapshot = useMemo(() => conv.snapshot(), [conv.step, conv.states.length, conv.userTurns.length]);
  useEffect(() => {
    if (!currentVersionId) return;
    if (loadingRef.current) { loadingRef.current = false; return; }
    (async () => {
      await saveVersion(currentVersionId, snapshot);
    })().catch(console.error);
  }, [snapshot, currentVersionId]);

  // ---- Handlers for VersionsBar ----
  const handleSelect = async (id) => {
    if (!id || id === currentVersionId) return;
    const v = await getVersion(id);
    loadingRef.current = true;
    conv.resetTo(v.payload);   // rewinds the entire left side (chat, states, etc.)
    setCurrentVersionId(id);
  };

  const handleRename = async () => {
    if (!currentVersionId) return;
    const v = versions.find(x => x.id === currentVersionId);
    const name = window.prompt("Rename version:", v?.name || "");
    if (!name) return;
    await renameVersion(currentVersionId, name);
    const list = await listVersions();
    setVersions(list);
  };

  const handleCreate = async () => {
    const name = defaultName(); // optional; backend would also auto-name
    const v = await createVersion(name);
    const list = await listVersions();
    setVersions(list);
    setCurrentVersionId(v.id);
    loadingRef.current = true;
    conv.resetTo(v.payload); // start from a brand new blank conversation
  };

  return (
    <div className="wrap">
      <div className="left">
        <DebugTabs tab={tab} onChange={setTab} />
        {tab === "json" && <ConversationJSON conv={conv} />}
        {tab !== "json" && (
          <ChatPanel
            conv={conv}
            botFlow={botFlow}
            widgetDefs={widgetDefs}
            view={tab === "clean" ? "clean" : "verbose"}
          />
        )}
      </div>

      <div className="right">
        <VersionsBar
          versions={versions}
          currentId={currentVersionId}
          onSelect={handleSelect}
          onRename={handleRename}
          onCreate={handleCreate}
        />
        <ResumePanel resume={conv.resume} />
      </div>

      <DevFooter />
    </div>
  );
}
