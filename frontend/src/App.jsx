import React, { useMemo, useState } from "react";

/**
 * -----------------------------------------------------------------------------
 * Minimal deterministic testbed for the data model:
 * - Left: chat-like bot steps that render dynamic widgets
 * - Right: live pretty-printed resume JSON
 * - Buttons: Undo (rewind & truncate), Show conversation JSON
 * -----------------------------------------------------------------------------
 */

/* ----------------------------- Helpers / Model ----------------------------- */

const deepClone = (x) => JSON.parse(JSON.stringify(x));
const genId = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 8)}`;

// Seed resume that covers contact, skills, experience, education
const seedResume = () => ({
  resume: {
    contact: {
      firstName: "Ava",
      lastName: "Nguyen",
      email: "",
      phone: "",
      links: []
    },
    summary: "",
    skills: [],
    sections: [
      {
        id: "sec_experience",
        name: "Experience",
        fields: ["title", "company", "location", "dates"],
        items: [
          {
            id: "itm_exp_1",
            fields: {
              title: "Senior Engineer",
              company: "Acme",
              location: "Denver, CO",
              dates: "2022–Present"
            },
            bullets: []
          }
        ]
      },
      {
        id: "sec_education",
        name: "Education",
        fields: ["school", "degree", "location", "date"],
        items: [
          {
            id: "itm_edu_1",
            fields: {
              school: "University of Somewhere",
              degree: "",
              location: "Somewhere, USA",
              date: "2020"
            },
            bullets: []
          }
        ]
      }
    ],
    meta: { format: "resume-v2", version: 2, locale: "en-US" }
  }
});

// Change shape (human-readable edit)
function makeChange(action, target, value) {
  return { action, target, value };
}

// Address helpers
function findSectionIndex(root, sectionId) {
  return root.resume.sections.findIndex((s) => s.id === sectionId);
}
function findItemIndex(root, sIdx, itemId) {
  return root.resume.sections[sIdx].items.findIndex((it) => it.id === itemId);
}

/* -------------------------- Change → JSON Patch apply -------------------------- */
/**
 * applyChangeOne: applies one Change to a cloned resume and returns { resume, patch }
 * Supported targets in this demo:
 * - { area: 'summary' }                                  → /resume/summary
 * - { area: 'contact', field: 'email'|'phone' }         → /resume/contact/<field>
 * - { area: 'contact', list: 'links' }                  → /resume/contact/links   (full replace)
 * - { area: 'skills',  list: 'skills' }                 → /resume/skills         (full replace)
 * - { area: 'section', sectionId, itemId, field }       → /resume/sections/s/items/i/fields/<field>
 * - { area: 'section', sectionId, itemId, list:'bullets'}→ /resume/sections/s/items/i/bullets (full replace)
 * - Optional add item (not used in the UI, but supported)
 */
function applyChangeOne(resumeIn, change) {
  const resume = deepClone(resumeIn);
  const { action, target, value } = change;

  const patch = { op: "replace", path: "", value: deepClone(value) };

  // Summary (text)
  if (target.area === "summary") {
    resume.resume.summary = value || "";
    patch.path = `/resume/summary`;
    return { resume, patch };
  }

  // Contact: single field
  if (target.area === "contact" && target.field) {
    resume.resume.contact[target.field] = value;
    patch.path = `/resume/contact/${target.field}`;
    return { resume, patch };
  }

  // Contact: links (full replace)
  if (target.area === "contact" && target.list === "links") {
    const rows = Array.isArray(value) ? value : [];
    const normalized = rows.map((r) => ({
      id: r.id || genId("lnk"),
      label: r.label || "",
      url: r.url || ""
    }));
    resume.resume.contact.links = normalized;
    patch.path = `/resume/contact/links`;
    patch.value = deepClone(normalized);
    return { resume, patch };
  }

  // Skills (full replace)
  if (target.area === "skills" && target.list === "skills") {
    const arr = Array.isArray(value) ? value : [];
    resume.resume.skills = arr;
    patch.path = `/resume/skills`;
    patch.value = deepClone(arr);
    return { resume, patch };
  }

  // Section-scoped edits
  if (target.area === "section") {
    const sIdx = findSectionIndex(resume, target.sectionId);
    if (sIdx < 0) throw new Error("Section not found");
    const section = resume.resume.sections[sIdx];

    // Human field edit on a specific item
    if (target.itemId && target.field) {
      const iIdx = findItemIndex(resume, sIdx, target.itemId);
      if (iIdx < 0) throw new Error("Item not found");
      section.items[iIdx].fields[target.field] = value;
      patch.path = `/resume/sections/${sIdx}/items/${iIdx}/fields/${target.field}`;
      return { resume, patch };
    }

    // Bullets (full replace) on a specific item
    if (target.itemId && target.list === "bullets") {
      const iIdx = findItemIndex(resume, sIdx, target.itemId);
      if (iIdx < 0) throw new Error("Item not found");
      const bullets = Array.isArray(value) ? value.filter(Boolean) : [];
      section.items[iIdx].bullets = bullets;
      patch.path = `/resume/sections/${sIdx}/items/${iIdx}/bullets`;
      patch.value = deepClone(bullets);
      return { resume, patch };
    }

    // Add a new item to the section (optional capability)
    if (!target.itemId && action === "add" && value && typeof value === "object") {
      section.items.push(value);
      patch.op = "add";
      patch.path = `/resume/sections/${sIdx}/items/-`;
      patch.value = deepClone(value);
      return { resume, patch };
    }
  }

  throw new Error("Unsupported change target in demo");
}

function applyChanges(resumeIn, changes) {
  let next = deepClone(resumeIn);
  const patchOps = [];
  for (const ch of changes) {
    if (!["set", "add", "remove"].includes(ch.action)) {
      throw new Error("Unsupported action in demo");
    }
    const { resume, patch } = applyChangeOne(next, ch);
    next = resume;
    patchOps.push(patch);
  }
  return { resume: next, patchOps };
}

/* --------------------------- Widget catalog / Flow -------------------------- */

const widgetDefs = [
  // TEXT → summary
  {
    id: "w_summary_text",
    kind: "text",
    title: "Write a short summary",
    target: { area: "summary" }
  },
  // SELECT → education degree
  {
    id: "w_degree_select",
    kind: "select",
    title: "Pick your degree",
    options: ["B.S. Computer Science", "B.A. Mathematics", "M.S. Data Science"],
    target: {
      area: "section",
      sectionId: "sec_education",
      itemId: "itm_edu_1",
      field: "degree"
    }
  },
  // MULTISELECT (+ add) → skills
  {
    id: "w_skills_ms",
    kind: "multiselect",
    title: "Select your skills (add your own too)",
    options: ["Python", "FastAPI", "TypeScript", "React"],
    allowAdd: true,
    target: { area: "skills", list: "skills" }
  },
  // FORM → contact email/phone
  {
    id: "w_contact_form",
    kind: "form",
    title: "Contact details",
    fields: [
      {
        name: "email",
        label: "Email",
        type: "email",
        target: { area: "contact", field: "email" }
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        target: { area: "contact", field: "phone" }
      }
    ]
  },
  // LIST → contact links (label + URL rows)
  {
    id: "w_links_list",
    kind: "list",
    title: "Add your links",
    itemShape: [
      { name: "label", label: "Link name", type: "text" },
      { name: "url", label: "URL", type: "url" }
    ],
    target: { area: "contact", list: "links" },
    addLabel: "Add link"
  },
  // LIST → bullets for experience item
  {
    id: "w_exp_bullets",
    kind: "list",
    title: "Bullets for your Acme role",
    itemShape: [{ name: "bullet", label: "Bullet", type: "text" }],
    target: {
      area: "section",
      sectionId: "sec_experience",
      itemId: "itm_exp_1",
      list: "bullets"
    },
    addLabel: "Add bullet"
  },
  // FORM (mini) → edit job title/company (human-only fields)
  {
    id: "w_job_mini_form",
    kind: "form",
    title: "Edit job basics (human-only)",
    fields: [
      {
        name: "title",
        label: "Title",
        type: "text",
        target: {
          area: "section",
          sectionId: "sec_experience",
          itemId: "itm_exp_1",
          field: "title"
        }
      },
      {
        name: "company",
        label: "Company",
        type: "text",
        target: {
          area: "section",
          sectionId: "sec_experience",
          itemId: "itm_exp_1",
          field: "company"
        }
      }
    ]
  }
];

// Toy “bot flow”: each step shows some widgets
const botFlow = [
  {
    id: "b1",
    text: "Let's set contact details and a link.",
    widgets: ["w_contact_form", "w_links_list"]
  },
  { id: "b2", text: "Pick your degree.", widgets: ["w_degree_select"] },
  {
    id: "b3",
    text: "Select skills (and add your own).",
    widgets: ["w_skills_ms"]
  },
  { id: "b4", text: "Add bullets for your Acme role.", widgets: ["w_exp_bullets"] },
  {
    id: "b5",
    text: "Optionally adjust job title/company.",
    widgets: ["w_job_mini_form"]
  },
  { id: "b6", text: "Write a short summary.", widgets: ["w_summary_text"] }
];

/* ----------------------------- Conversation State ---------------------------- */

function makeGenesis() {
  const st = {
    stateId: "st_1",
    parentStateId: null,
    createdAt: new Date().toISOString(),
    snapshotJson: seedResume()
  };
  return {
    resume: deepClone(st.snapshotJson),
    states: [st],
    activeStateId: st.stateId,
    autosaveStateId: st.stateId,
    userTurns: [], // only user turns stored; bot text comes from botFlow
    step: 0
  };
}

/* --------------------------------- Widgets UI -------------------------------- */

function TextWidget({ value, setValue, def }) {
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      <input
        className="winput"
        value={value ?? ""}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type here..."
      />
    </div>
  );
}

function SelectWidget({ value, setValue, def }) {
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      <select
        className="winput"
        value={value ?? ""}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="">—</option>
        {def.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function MultiSelectWidget({ value, setValue, def }) {
  const [add, setAdd] = useState("");
  const selected = value ?? [];
  const toggle = (opt) => {
    if (selected.includes(opt)) setValue(selected.filter((x) => x !== opt));
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
        {def.options.map((opt) => (
          <button
            type="button"
            key={opt}
            className={"chip " + (selected.includes(opt) ? "on" : "")}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      {def.allowAdd && (
        <div className="row">
          <input
            className="winput"
            value={add}
            onChange={(e) => setAdd(e.target.value)}
            placeholder="Add custom…"
          />
          <button type="button" onClick={addCustom}>
            Add
          </button>
        </div>
      )}
      {selected.length > 0 && (
        <div className="small">Selected: {selected.join(", ")}</div>
      )}
    </div>
  );
}

function FormWidget({ value, setValue, def }) {
  const v = value ?? {};
  const setField = (name, val) => setValue({ ...v, [name]: val });
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      {def.fields.map((f) => (
        <div className="row" key={f.name}>
          <label style={{ width: 120 }}>{f.label}</label>
          <input
            className="winput"
            type={f.type === "date" ? "text" : f.type}
            value={v[f.name] ?? ""}
            onChange={(e) => setField(f.name, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

function ListWidget({ value, setValue, def }) {
  const rows = value ?? [];
  const addRow = () => {
    const base = {};
    def.itemShape.forEach((f) => (base[f.name] = ""));
    setValue([...rows, { id: genId("row"), ...base }]);
  };
  const delRow = (id) => setValue(rows.filter((r) => r.id !== id));
  const setCell = (id, name, val) =>
    setValue(rows.map((r) => (r.id === id ? { ...r, [name]: val } : r)));
  return (
    <div className="wbox">
      <div className="wtitle">{def.title}</div>
      {rows.map((r) => (
        <div className="row gap" key={r.id}>
          {def.itemShape.map((f) => (
            <input
              key={f.name}
              className="winput"
              placeholder={f.label}
              value={r[f.name] ?? ""}
              onChange={(e) => setCell(r.id, f.name, e.target.value)}
            />
          ))}
          <button type="button" onClick={() => delRow(r.id)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow}>
        {def.addLabel || "Add"}
      </button>
    </div>
  );
}

function Widget({ def, value, setValue }) {
  if (def.kind === "text") return <TextWidget def={def} value={value} setValue={setValue} />;
  if (def.kind === "select") return <SelectWidget def={def} value={value} setValue={setValue} />;
  if (def.kind === "multiselect") return <MultiSelectWidget def={def} value={value} setValue={setValue} />;
  if (def.kind === "form") return <FormWidget def={def} value={value} setValue={setValue} />;
  if (def.kind === "list") return <ListWidget def={def} value={value} setValue={setValue} />;
  return <div className="wbox">[Unsupported widget in demo]</div>;
}

/* ----------------------------------- App ----------------------------------- */

export default function App() {
  const [conv, setConv] = useState(makeGenesis());
  const [showConvJSON, setShowConvJSON] = useState(false);

  const stepDef = botFlow[conv.step] || null;

  // Per-step input stash keyed by widgetId
  const [inputs, setInputs] = useState({});
  const setInput = (wid, val) => setInputs((prev) => ({ ...prev, [wid]: val }));

  const currentWidgets = useMemo(() => {
    if (!stepDef) return [];
    return stepDef.widgets
      .map((id) => widgetDefs.find((w) => w.id === id))
      .filter(Boolean);
  }, [stepDef]);

  // Build Changes from the current step's inputs (pure & simple)
  function buildChangesFromInputs() {
    const changes = [];

    for (const wid of Object.keys(inputs)) {
      const def = widgetDefs.find((w) => w.id === wid);
      const val = inputs[wid];
      if (!def) continue;

      if (def.kind === "text") {
        changes.push(makeChange("set", def.target, val ?? ""));
      }

      if (def.kind === "select") {
        changes.push(makeChange("set", def.target, val ?? ""));
      }

      if (def.kind === "multiselect") {
        const arr = Array.isArray(val) ? val : [];
        changes.push(makeChange("set", def.target, arr));
      }

      if (def.kind === "form") {
        const v = val || {};
        for (const f of def.fields) {
          changes.push(makeChange("set", f.target, v[f.name] ?? ""));
        }
      }

      if (def.kind === "list") {
        // contact links (label+url rows)
        if (def.target.area === "contact" && def.target.list === "links") {
          const rows = (val || []).map((r) => ({
            id: r.id || genId("lnk"),
            label: r.label || "",
            url: r.url || ""
          }));
          changes.push(makeChange("set", def.target, rows));
        }
        // bullets for a specific experience item
        else if (def.target.list === "bullets") {
          const bullets = (val || [])
            .map((r) => (typeof r.bullet === "string" ? r.bullet.trim() : ""))
            .filter(Boolean);
          changes.push(makeChange("set", def.target, bullets));
        }
      }
    }

    return changes;
  }

  // Submit: apply changes atomically → record patchSet → push new state
  function submitStep() {
    if (!stepDef) return;

    const changes = buildChangesFromInputs();
    if (changes.length === 0) {
      // allow advancing without edits
      setConv((prev) => ({ ...prev, step: Math.min(prev.step + 1, botFlow.length) }));
      setInputs({});
      return;
    }

    const { resume, patchOps } = applyChanges(conv.resume, changes);

    const patchSet = {
      id: genId("ps"),
      author: "user",
      source: "ui",
      status: "applied",
      createdAt: new Date().toISOString(),
      changes,
      patchOps
    };

    const newState = {
      stateId: genId("st"),
      parentStateId: conv.activeStateId,
      createdAt: new Date().toISOString(),
      snapshotJson: deepClone(resume)
    };

    setConv((prev) => ({
      ...prev,
      resume,
      states: [...prev.states, newState],
      activeStateId: newState.stateId,
      autosaveStateId: newState.stateId,
      userTurns: [
        ...prev.userTurns,
        {
          id: genId("t"),
          step: prev.step,
          widgets: stepDef.widgets.slice(),
          inputs: deepClone(inputs),
          patchSet
        }
      ],
      step: Math.min(prev.step + 1, botFlow.length)
    }));

    setInputs({});
  }

  // Undo: rewind one state, truncate the last user turn, go back one bot step
  function undoLast() {
    setConv((prev) => {
      if (prev.states.length <= 1) return prev;
      const states = prev.states.slice(0, -1);
      const resume = deepClone(states[states.length - 1].snapshotJson);
      const userTurns = prev.userTurns.slice(0, -1);
      const step = Math.max(prev.step - 1, 0);
      const activeStateId = states[states.length - 1].stateId;
      return {
        ...prev,
        resume,
        states,
        userTurns,
        step,
        activeStateId,
        autosaveStateId: activeStateId
      };
    });
  }

  const prettyResume = useMemo(() => JSON.stringify(conv.resume, null, 2), [conv.resume]);
  const prettyConversation = useMemo(() => {
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
    <div className="wrap">
      <div className="left">
        <div className="toolbar">
          <button onClick={undoLast} disabled={conv.states.length <= 1}>
            Undo
          </button>
          <button onClick={() => setShowConvJSON((s) => !s)}>
            {showConvJSON ? "Hide conversation JSON" : "Show conversation JSON"}
          </button>
        </div>

        <div className="chat">
          {/* Prior steps: show bot text + what user submitted + patchSet */}
          {conv.userTurns.map((ut) => {
            const bot = botFlow[ut.step];
            return (
              <div key={ut.id}>
                <div className="bot">{bot?.text || "(bot)"}</div>
                <div className="user">
                  <div>
                    <b>User submitted:</b>
                  </div>
                  <pre className="mini">{JSON.stringify(ut.inputs, null, 2)}</pre>
                  <div>
                    <b>PatchSet:</b>
                  </div>
                  <pre className="mini">{JSON.stringify(ut.patchSet, null, 2)}</pre>
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
                  <Widget
                    key={def.id}
                    def={def}
                    value={inputs[def.id]}
                    setValue={(v) => setInput(def.id, v)}
                  />
                ))}
              </div>
              <div className="submit">
                <button onClick={submitStep}>Submit</button>
              </div>
            </>
          ) : (
            <div className="bot">End of demo flow. You can Undo to rewind.</div>
          )}
        </div>

        {showConvJSON && (
          <div className="convjson">
            <div>
              <b>Conversation (states + userTurns)</b>
            </div>
            <pre>{prettyConversation}</pre>
          </div>
        )}
      </div>

      <div className="right">
        <div className="rtitle">Live Resume JSON</div>
        <pre className="json">{prettyResume}</pre>
      </div>

      <style>{`
        .wrap { display:flex; gap:16px; padding:16px; font-family: system-ui,-apple-system, Segoe UI, Roboto, sans-serif; }
        .left { flex: 1; min-width: 0; }
        .right { flex: 1; min-width: 0; background: #0b1020; color:#cfe3ff; border-radius: 12px; padding: 12px; }
        .rtitle { font-weight: 700; margin-bottom: 6px; }
        .json { white-space: pre-wrap; word-break: break-word; font-size: 12px; }

        .toolbar { display:flex; gap:8px; margin-bottom: 8px; }
        .chat { display:flex; flex-direction: column; gap: 12px; }
        .bot { background:#f3f6ff; border:1px solid #e3eaff; padding:10px 12px; border-radius: 10px; }
        .user { background:#f9f9f9; border:1px solid #eee; padding:10px 12px; border-radius: 10px; }
        .widgets { display:flex; flex-direction: column; gap: 8px; }
        .submit { margin-top: 8px; }
        .wbox { border:1px solid #eaeaea; border-radius: 10px; padding: 10px; }
        .wtitle { font-weight: 600; margin-bottom: 6px; }
        .winput { flex:1; padding:8px; border:1px solid #ddd; border-radius:8px; }
        .row { display:flex; align-items:center; gap:8px; margin:6px 0; }
        .row.gap { gap:8px; }
        .chips { display:flex; flex-wrap: wrap; gap:6px; margin-bottom:6px; }
        .chip { padding:6px 10px; border-radius: 999px; border:1px solid #ddd; background:#fff; cursor:pointer; }
        .chip.on { background:#e7f0ff; border-color:#8fb6ff; }
        .small { font-size: 12px; color:#666; margin-top:4px; }
        .mini { font-size: 11px; background:#111; color:#eee; padding:8px; border-radius:8px; overflow:auto; }
        .convjson { margin-top: 12px; }
      `}</style>
    </div>
  );
}
