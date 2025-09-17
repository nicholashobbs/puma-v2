# Puma v2 — Developer README (snapshot)
_Generated automatically on 2025-09-17 20:43 UTC_

## TL;DR
Puma v2 is a **versioned resume builder**. Each “version” stores an entire conversation snapshot (chat state + turns + current resume JSON). The frontend (Vite + React) drives a chat-like flow with widgets, builds change objects, applies them to a resume document, and **autosaves** the full snapshot to the active version via a FastAPI backend. The backend persists versions as **JSONB** in Postgres 16 through **SQLAlchemy 2** + **Pydantic v2**. Nginx serves the built SPA. Redis is present in Docker but currently unused.

---

## Repository Structure
```
├── .gitignore
├── docker-compose.yml
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── db.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
├── frontend/
│   ├── index.html
│   ├── nginx.conf
│   ├── package-lock.json
│   ├── package.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.jsx
│   │   ├── app.css
│   │   ├── main.jsx
│   │   ├── api/
│   │   │   ├── versions.js
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── ConversationJSON.jsx
│   │   │   ├── DebugTabs.jsx
│   │   │   ├── DevFooter.jsx
│   │   │   ├── ResumePanel.jsx
│   │   │   ├── Toolbar.jsx
│   │   │   ├── VersionsBar.jsx
│   │   │   ├── WidgetRenderer.jsx
│   │   ├── lib/
│   │   │   ├── change.js
│   │   │   ├── resumeSeed.js
│   │   │   ├── utils.js
│   │   │   ├── widgets.js
│   │   ├── state/
│   │   │   ├── useConversation.js
├── public/
│   ├── index.html
```

### Notable files
- **docker-compose.yml** — Orchestrates `db` (Postgres 16), `redis` (unused), `api` (FastAPI/Uvicorn), and `web` (Nginx serving `frontend/dist`). The file in this snapshot includes an elision block (`...`) in the middle; your live file likely defines the `api` service and any additional settings there.
- **api/Dockerfile** — Python 3.12 slim, installs requirements, runs Uvicorn with `app.main:app` on port 8000.
- **api/requirements.txt** — Pinned deps: fastapi==0.114.2, uvicorn[standard]==0.30.6, SQLAlchemy==2.0.35, psycopg[binary]==3.2.1, pydantic==2.9.2, redis==5.0.8, python-dotenv==1.0.1.
- **api/app/db.py** — SQLAlchemy engine + session factory, `init_db()` to create tables from models. Default `DATABASE_URL`: `postgresql+psycopg://puma:puma@db:5432/puma_v2`.
- **api/app/models.py** — SQLAlchemy declarative models (currently a single `Version` table; see schema below).
- **api/app/schemas.py** — Pydantic v2 schemas for request/response shapes (`Version*` models). (The snapshot shows some sections abbreviated, but runtime code references `VersionCreate`, `VersionRename`, etc.)
- **api/app/main.py** — FastAPI app with CORS `*`, health check, and Versions CRUD; includes default seed generators for resume/payload.

- **frontend/** — Vite + React SPA:
  - `index.html`, `vite.config.js`, `package.json`
  - `nginx.conf` (SPA fallback config for Nginx)
  - `src/`:
    - `main.jsx` — mounts `<App/>`.
    - `App.jsx` — loads/creates version on mount; wires autosave to `PUT /api/versions/:id`; renders chat & panels; manages version switch/rename/create.
    - `components/`
      - `ChatPanel.jsx` — renders current bot step + widgets; builds change objects; calls reducer submit.
      - `WidgetRenderer.jsx` — UI primitives: text/select/multi-select/list/form widgets.
      - `ResumePanel.jsx` — pretty JSON of current resume.
      - `VersionsBar.jsx` — dropdown + Rename + New+.
      - `ConversationJSON.jsx` — trimmed conversation debug view.
      - `DebugTabs.jsx`, `DevFooter.jsx`, `Toolbar.jsx` — dev/UX affordances.
    - `lib/`
      - `widgets.js` — `widgetDefs` & `botFlow` (b1…b6) that drive the chat.
      - `change.js` — builds changes, applies them (`applyChanges` returns `{resume, patchOps}`).
      - `utils.js` — `deepClone`, `genId` helpers.
      - `resumeSeed.js` — same default seed as backend (Ava Nguyen, Acme role).
    - `state/useConversation.js` — reducer + hook holding `{resume, states, userTurns, activeStateId, autosaveStateId, step}` and actions (`submitStep`, `undo`, `advanceNoop`, `resetTo`, `snapshot`).
    - `api/versions.js` — thin fetch wrappers for Versions endpoints.
- **public/index.html** — A small “staging” placeholder page for live envs (not used by the Vite build output).

---

## How it Works (End-to-End)
1. **App init**
   - Frontend calls `GET /api/versions`.
   - If empty, it issues `POST /api/versions` (optionally with a `name`). Backend seeds a default **payload**.
   - The chosen version’s `payload` is loaded into `useConversation.resetTo(payload)`.

2. **User interaction**
   - `botFlow` defines steps with `widgets`. `ChatPanel` renders the widgets for the current step.
   - On submit, the UI uses `buildChangesFromInputs(inputs, currentWidgets)` → an array of **changes** (e.g., set summary, add link, add bullets).
   - `applyChanges(resume, changes)` returns an updated resume and a list of **JSON Patch-like** `patchOps` used in the UI turn summary.

3. **Conversation state**
   - The reducer records a new **state snapshot** (`stateId`, `parentStateId`, `createdAt`, `snapshotJson`) and a **userTurn** (step, changes, patchOps), then advances `step`.

4. **Autosave**
   - A `useEffect` in `App.jsx` detects conversation changes and calls `PUT /api/versions/:id { payload: conv.snapshot() }`.
   - Switching versions calls `GET /api/versions/:id` and `resetTo()`; Rename calls `PATCH /api/versions/:id/rename`.

---

## Data Model

### Postgres (SQLAlchemy model → table `versions`)
```sql
-- Derived from api/app/models.py
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  name VARCHAR(200) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_versions_user_id ON versions (user_id);
CREATE INDEX ix_versions_name ON versions (name);
```
> Note: `updated_at` is maintained by SQLAlchemy’s `onupdate=func.now()`; there is no Postgres trigger in this snapshot.

### JSON payload shape (stored in `versions.payload`)
```jsonc
{
  "resume": {
    "contact": { "firstName": "", "lastName": "", "email": "", "phone": "", "links": [] },
    "summary": "",
    "skills": [],
    "sections": [
      {
        "id": "sec_experience",
        "name": "Experience",
        "fields": ["title","company","location","dates"],
        "items": [
          {
            "id": "itm_exp_1",
            "fields": { "title": "Software Engineer", "company": "Acme", "location": "Denver, CO", "dates": "2022–Present" },
            "bullets": []
          }
        ]
      },
      {
        "id": "sec_education",
        "name": "Education",
        "fields": ["school","degree","location","date"],
        "items": [
          {
            "id": "itm_edu_1",
            "fields": { "school": "University of Somewhere", "degree": "", "location": "Somewhere, USA", "date": "2020" },
            "bullets": []
          }
        ]
      }
    ],
    "meta": { "format": "resume-v2", "version": 2, "locale": "en-US" }
  },
  "states": [
    { "stateId": "st_init", "parentStateId": null, "createdAt": "2025-01-01T00:00:00Z", "snapshotJson": { /* same as resume */ } }
  ],
  "activeStateId": "st_init",
  "autosaveStateId": "st_init",
  "userTurns": [],
  "step": 0
}
```

---

## API
Base URL defaults to **`/api`** behind Nginx. (In your notes/tests, host port **8002** is used for the API container.)

### Routes (discovered from `api/app/main.py`)
- `GET /api/ping`
- `GET /api/versions`
- `POST /api/versions`
- `GET /api/versions/{version_id}`
- `PATCH /api/versions/{version_id}/rename`
- `PUT /api/versions/{version_id}`

### Shapes (Pydantic v2)
- **VersionShort**: `{ id: UUID, name: string, created_at: datetime, updated_at?: datetime }`
- **VersionOut**: `VersionShort & { payload: object }`
- **VersionCreate** (body): `{ name?: string, payload?: object, data?: object }`
- **VersionRename** (body): `{ name: string }`
- **VersionReplace** (body): `{ payload?: object, data?: object }`

### Typical calls
```bash
# Health
curl -s http://127.0.0.1:8002/api/ping

# List versions
curl -s http://127.0.0.1:8002/api/versions

# Create new version (optional name)
curl -s -X POST http://127.0.0.1:8002/api/versions -H 'Content-Type: application/json' -d '{"name":"demo-1"}'

# Get by id
curl -s http://127.0.0.1:8002/api/versions/$VID | jq .

# Rename
curl -s -X PATCH http://127.0.0.1:8002/api/versions/$VID/rename -H 'Content-Type: application/json' -d '{"name":"renamed"}'

# Replace payload (autosave path)
curl -s -X PUT http://127.0.0.1:8002/api/versions/$VID -H 'Content-Type: application/json' -d '{"payload":{}}'
```

---

## Frontend Details

- **State shape** mirrors backend payload: `{ resume, states[], userTurns[], activeStateId, autosaveStateId, step }`.
- **Autosave** runs whenever the reducer changes state; it serializes a **snapshot** and calls `saveVersion(id, payload)`.
- **Widgets & flow** (`lib/widgets.js`):
  - `widgetDefs`: text, select, multi-select, list, mini-form.
  - `botFlow`:
    1. Contact + links
    2. Degree select
    3. Skills multi-select (+ custom)
    4. Experience bullets
    5. Mini form (job basics)
    6. Summary text
- **Change application** (`lib/change.js`): `applyChanges(resume, changes)` iterates over change objects (actions: `set|add|remove`) and returns the new resume + patch operations used to render turn summaries.

---

## Running Locally (Docker)

> The included `docker-compose.yml` shows `db`, `redis`, and `web`, with an elided middle section (`...`). Your live compose should define an `api` service that builds `./api` and maps its port. The commands below assume the API is reachable on **127.0.0.1:8002** and Nginx on **127.0.0.1:3102**.

1. **Database env** — Create `.env.db` in repo root (compose references it):
```env
POSTGRES_USER=puma
POSTGRES_PASSWORD=puma
POSTGRES_DB=puma_v2
```

2. **Start DB + API**
```bash
sudo docker compose -p puma_v2 up -d --build db api
```
   (The API container runs Uvicorn on 0.0.0.0:8000; map host 8002 → container 8000 in compose.)

3. **Initialize schema** — On first boot, `api/app/db.py:init_db()` will create tables. Verify:
   ```bash
docker exec -it puma_v2_db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\d+ versions'
```

4. **Build frontend + restart Nginx**
```bash
cd frontend
npm i && npm run build
cd ..
sudo docker compose -p puma_v2 up -d --no-deps --force-recreate web
```

5. **Smoke test**
```bash
curl -s http://127.0.0.1:8002/api/ping
curl -s http://127.0.0.1:8002/api/versions
```

---

## Notes & Gotchas
- **Pydantic v2**: use `ConfigDict(from_attributes=True)`; don’t mix legacy `Config`.
- **Back-compat on body**: API accepts `payload` **or** `data`; server prefers `payload`.
- **`user_id` type**: In this snapshot, `user_id` is **UUID nullable** (differs from earlier TEXT default `'user'`). Auth TBD.
- **`updated_at`**: maintained via SQLAlchemy’s `onupdate`; no DB trigger present here.
- **Redis**: provisioned but currently unused.
- **CORS**: wide-open for dev (`*`). Tighten before prod.

---

## Where to Extend Next
- **Auth & multi-user**: make `user_id` required; thread it through requests; add `(user_id, created_at DESC)` index for lists.
- **Validation**: optional stricter Pydantic models for payload shape.
- **Diffs**: consider storing compact deltas per turn alongside snapshots.
- **Redis**: reserve for future jobs/queues or caching layer.

---

## Appendix
- **Default seed** mirrors `frontend/src/lib/resumeSeed.js` (Ava Nguyen, Acme role, one education item).
- **Nginx** serves `frontend/dist` with SPA fallback from `frontend/nginx.conf`.
