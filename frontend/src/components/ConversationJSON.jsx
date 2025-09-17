import React, { useMemo } from "react";

export default function ConversationJSON({ conv }) {
  const pretty = useMemo(() => {
    const payload = {
      activeStateId: conv.activeStateId,
      autosaveStateId: conv.autosaveStateId,
      states: conv.states.map((s) => ({
        stateId: s.stateId,
        parentStateId: s.parentStateId,
        createdAt: s.createdAt
      })),
      userTurns: conv.userTurns
    };
    return JSON.stringify(payload, null, 2);
  }, [conv]);

  return (
    <div className="convjson">
      <div><b>Conversation (states + userTurns)</b></div>
      <pre className="mini">{pretty}</pre>
    </div>
  );
}
