import React, { useState } from "react";

function TextWidget({ value, setValue, def }) {
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      <input className="winput" value={value ?? ""} onChange={e=>setValue(e.target.value)} placeholder="Type here..." />
    </div>
  );
}

function SelectWidget({ value, setValue, def }) {
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      <select className="winput" value={value ?? ""} onChange={e=>setValue(e.target.value)}>
        <option value="">—</option>
        {def.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function MultiSelectWidget({ value, setValue, def }) {
  const [add, setAdd] = useState("");
  const selected = value ?? [];
  const toggle = (opt) => {
    if (selected.includes(opt)) setValue(selected.filter(x=>x!==opt));
    else setValue([...selected, opt]);
  };
  const addCustom = () => {
    const v = add.trim();
    if (!v) return;
    if (!selected.includes(v)) setValue([...selected, v]);
    setAdd("");
  };
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      <div className="chips">
        {def.options.map(opt => (
          <button type="button" key={opt}
            className={"chip "+(selected.includes(opt)?"on":"")}
            onClick={()=>toggle(opt)}>{opt}</button>
        ))}
      </div>
      {def.allowAdd && (
        <div className="row">
          <input className="winput" value={add} onChange={e=>setAdd(e.target.value)} placeholder="Add custom…" />
          <button type="button" onClick={addCustom}>Add</button>
        </div>
      )}
      {selected.length>0 && <div className="small">Selected: {selected.join(", ")}</div>}
    </div>
  );
}

function FormWidget({ value, setValue, def }) {
  const v = value ?? {};
  const setField = (name, val) => setValue({ ...v, [name]: val });
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      {def.fields.map(f => (
        <div className="row" key={f.name}>
          <label>{f.label}</label>
          <input className="winput" type={f.type==="date"?"text":f.type}
                 value={v[f.name] ?? ""} onChange={e=>setField(f.name, e.target.value)} />
        </div>
      ))}
    </div>
  );
}

function ListWidget({ value, setValue, def }) {
  const rows = value ?? [];
  const addRow = () => {
    const base = {};
    def.itemShape.forEach(f => base[f.name] = "");
    setValue([ ...rows, { id: cryptoRandom("row"), ...base } ]);
  };
  const delRow = (id) => setValue(rows.filter(r=>r.id!==id));
  const setCell = (id, name, val) => setValue(rows.map(r=>r.id===id ? { ...r, [name]: val } : r));
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      {rows.map(r => (
        <div className="row gap" key={r.id}>
          {def.itemShape.map(f => (
            <input key={f.name} className="winput"
                   placeholder={f.label} value={r[f.name] ?? ""}
                   onChange={e=>setCell(r.id, f.name, e.target.value)} />
          ))}
          <button type="button" onClick={()=>delRow(r.id)}>×</button>
        </div>
      ))}
      <button type="button" onClick={addRow}>{def.addLabel || "Add"}</button>
    </div>
  );
}

function cryptoRandom(prefix="id") {
  // Nice ids without bringing in a library
  return `${prefix}_${Math.random().toString(36).slice(2,8)}`;
}

export default function WidgetRenderer({ def, value, setValue }) {
  if (def.kind === "text") return <TextWidget def={def} value={value} setValue={setValue} />;
  if (def.kind === "select") return <SelectWidget def={def} value={value} setValue={setValue} />;
  if (def.kind === "multiselect") return <MultiSelectWidget def={def} value={value} setValue={setValue} />;
  if (def.kind === "form") return <FormWidget def={def} value={value} setValue={setValue} />;
  if (def.kind === "list") return <ListWidget def={def} value={value} setValue={setValue} />;
  return <div className="wbox">[Unsupported widget]</div>;
}
