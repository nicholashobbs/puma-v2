import React from "react";

export default function Toolbar({ canUndo, onUndo, showConvJSON, onToggleConvJSON }) {
  return (
    <div className="toolbar">
      <button onClick={onUndo} disabled={!canUndo}>Undo</button>
      <button onClick={onToggleConvJSON}>
        {showConvJSON ? "Hide conversation JSON" : "Show conversation JSON"}
      </button>
    </div>
  );
}
