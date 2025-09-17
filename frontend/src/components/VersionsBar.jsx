import React from 'react';

export default function VersionsBar({
  versions,
  currentId,
  onSelect,
  onRename,
  onCreate
}) {
  return (
    <div className="versionsbar">
      <div className="leftside">
        <label style={{marginRight:8}}>Version:</label>
        <select
          className="winput"
          value={currentId || ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          {versions.map(v => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div className="rightside" style={{display:'flex', gap:8}}>
        <button onClick={onRename} title="Rename this version">Rename</button>
        <button onClick={onCreate} title="Create a new blank version">New +</button>
      </div>
    </div>
  );
}
