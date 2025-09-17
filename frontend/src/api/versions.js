// src/api/versions.js
const BASE = "/api";

async function asJson(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listVersions() {
  const res = await fetch(`${BASE}/versions`, { method: "GET" });
  return asJson(res); // [{id,name,created_at,updated_at}]
}

export async function getVersion(id) {
  const res = await fetch(`${BASE}/versions/${id}`, { method: "GET" });
  return asJson(res); // {id,name,created_at,updated_at,payload}
}

export async function createVersion(name) {
  const body = name ? { name } : {};
  const res = await fetch(`${BASE}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return asJson(res); // {id,name,created_at,updated_at,payload}
}

export async function renameVersion(id, name) {
  const res = await fetch(`${BASE}/versions/${id}/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return asJson(res); // {id,name,created_at,updated_at}
}

export async function saveVersion(id, payload) {
  // Backend accepts {payload} or {data}; we send {payload}
  const res = await fetch(`${BASE}/versions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  return asJson(res); // {id,name,created_at,updated_at,payload}
}
