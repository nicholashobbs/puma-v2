import { deepClone, genId } from "./utils.js";

/**
 * Human-readable edit
 */
export function makeChange(action, target, value) {
  return { action, target, value };
}

/**
 * Build Changes from current step inputs + widget definitions
 */
export function buildChangesFromInputs(inputs, currentWidgets) {
  const changes = [];
  const byId = Object.fromEntries(currentWidgets.map(w => [w.id, w]));
  for (const wid of Object.keys(inputs)) {
    const def = byId[wid];
    if (!def) continue;
    const val = inputs[wid];

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
      if (def.target.area === "contact" && def.target.list === "links") {
        const rows = (val || []).map((r) => ({
          id: r.id || genId("lnk"),
          label: r.label || "",
          url: r.url || ""
        }));
        changes.push(makeChange("set", def.target, rows));
      } else if (def.target.list === "bullets") {
        const bullets = (val || [])
          .map((r) => (typeof r.bullet === "string" ? r.bullet.trim() : ""))
          .filter(Boolean);
        changes.push(makeChange("set", def.target, bullets));
      }
    }
  }
  return changes;
}

/**
 * Apply a batch of Changes → { resume, patchOps }
 * (Uses applyChangeOne under the hood)
 */
export function applyChanges(resumeIn, changes) {
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

/**
 * Apply one Change → mutate clone & return { resume, patch }
 * Supported targets:
 * - { area: 'summary' }
 * - { area: 'contact', field: 'email'|'phone' }
 * - { area: 'contact', list: 'links' }
 * - { area: 'skills',  list: 'skills' }
 * - { area: 'section', sectionId, itemId, field }
 * - { area: 'section', sectionId, itemId, list:'bullets' }
 */
export function applyChangeOne(resumeIn, change) {
  const resume = deepClone(resumeIn);
  const { action, target, value } = change;
  const patch = { op: "replace", path: "", value: deepClone(value) };

  const findSectionIndex = (sectionId) =>
    resume.resume.sections.findIndex((s) => s.id === sectionId);
  const findItemIndex = (sIdx, itemId) =>
    resume.resume.sections[sIdx].items.findIndex((it) => it.id === itemId);

  if (target.area === "summary") {
    resume.resume.summary = value || "";
    patch.path = `/resume/summary`;
    return { resume, patch };
  }

  if (target.area === "contact" && target.field) {
    resume.resume.contact[target.field] = value;
    patch.path = `/resume/contact/${target.field}`;
    return { resume, patch };
  }

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

  if (target.area === "skills" && target.list === "skills") {
    const arr = Array.isArray(value) ? value : [];
    resume.resume.skills = arr;
    patch.path = `/resume/skills`;
    patch.value = deepClone(arr);
    return { resume, patch };
  }

  if (target.area === "section") {
    const sIdx = findSectionIndex(target.sectionId);
    if (sIdx < 0) throw new Error("Section not found");
    const section = resume.resume.sections[sIdx];

    if (target.itemId && target.field) {
      const iIdx = findItemIndex(sIdx, target.itemId);
      if (iIdx < 0) throw new Error("Item not found");
      section.items[iIdx].fields[target.field] = value;
      patch.path = `/resume/sections/${sIdx}/items/${iIdx}/fields/${target.field}`;
      return { resume, patch };
    }

    if (target.itemId && target.list === "bullets") {
      const iIdx = findItemIndex(sIdx, target.itemId);
      if (iIdx < 0) throw new Error("Item not found");
      const bullets = Array.isArray(value) ? value.filter(Boolean) : [];
      section.items[iIdx].bullets = bullets;
      patch.path = `/resume/sections/${sIdx}/items/${iIdx}/bullets`;
      patch.value = deepClone(bullets);
      return { resume, patch };
    }

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
