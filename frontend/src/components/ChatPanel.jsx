import React, { useMemo, useState } from "react";
import WidgetRenderer from "./WidgetRenderer.jsx";
import { buildChangesFromInputs, applyChanges } from "../lib/change.js";

export default function ChatPanel({ conv, botFlow, widgetDefs, view }) {
  const stepDef = botFlow[conv.step] || null;
  const [inputs, setInputs] = useState({}); // widgetId -> value

  const currentWidgets = useMemo(() => {
    if (!stepDef) return [];
    return stepDef.widgets
      .map((id) => widgetDefs.find((w) => w.id === id))
      .filter(Boolean);
  }, [stepDef, widgetDefs]);

  const setInput = (widgetId, value) => {
    setInputs((prev) => ({ ...prev, [widgetId]: value }));
  };

  function onSubmit() {
    if (!stepDef) return;
    const changes = buildChangesFromInputs(inputs, currentWidgets);
    if (changes.length === 0) {
      conv.advanceNoop();
      setInputs({});
      return;
    }

    // Compute resumeAfter + patchOps before dispatching
    const { resume: resumeAfter, patchOps } = applyChanges(conv.resume, changes);
    conv.submitStep(changes, stepDef.widgets, inputs, resumeAfter, patchOps);
    setInputs({});
  }

  // Turn summarizer (for "clean" view)
  function summarizeInputs(inputsObj) {
    const lines = [];
    for (const [wid, val] of Object.entries(inputsObj)) {
      if (Array.isArray(val)) {
        lines.push(`${wid}: ${val.join(", ")}`);
      } else if (val && typeof val === "object") {
        // form or list
        const keys = Object.keys(val);
        lines.push(`${wid}: ${keys.slice(0, 3).map(k => `${k}=${val[k] ?? ""}`).join(", ")}`);
      } else {
        lines.push(`${wid}: ${val ?? ""}`);
      }
    }
    return lines.join(" • ");
  }

  return (
    <div className="chat">
      {/* Past turns */}
      {conv.userTurns.map((ut, idx) => {
        const isLast = idx === conv.userTurns.length - 1;
        const bot = botFlow[ut.step];
        return (
          <div key={ut.id}>
            <div className="bot">{bot?.text || "(bot)"}</div>

            <div className="user">
              {view === "verbose" ? (
                <>
                  <div><b>User submitted:</b></div>
                  <pre className="mini">{JSON.stringify(ut.inputs, null, 2)}</pre>
                  <div><b>PatchSet:</b></div>
                  <pre className="mini">{JSON.stringify(ut.patchSet, null, 2)}</pre>
                </>
              ) : (
                <>
                  <div><b>User:</b> {summarizeInputs(ut.inputs) || "(no changes)"}</div>
                </>
              )}

              {/* Inline Undo under most recent user message */}
              {isLast && conv.states.length > 1 && (
                <div className="undoRow">
                  <button className="undoLink" onClick={conv.undo} title="Undo last step">
                    <span aria-hidden>↶</span> Undo
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Current step */}
      {stepDef ? (
        <>
          <div className="bot">{stepDef.text}</div>
          <div className="widgets">
            {currentWidgets.map((def) => (
              <WidgetRenderer
                key={def.id}
                def={def}
                value={inputs[def.id]}
                setValue={(v) => setInput(def.id, v)}
              />
            ))}
          </div>
          <div className="submit">
            <button onClick={onSubmit}>Submit</button>
          </div>
        </>
      ) : (
        <div className="bot">End of demo flow. You can Undo to rewind.</div>
      )}
    </div>
  );
}
