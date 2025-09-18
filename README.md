# Puma v2 — Resume Builder (robust baseline)

A versioned, autosaving resume-builder with a React + Vite frontend and FastAPI backend. Each **version** is a full, independent conversation snapshot containing the chat state, user turns, current step, and a `resume` JSON. You can rename versions, switch between them, and everything autosaves to Postgres.

This README covers:

* What’s built (frontend + backend)
* Tech stack and rationale
* Data model (JSON & Postgres)
* **Frontend architecture** (state, components, autosave, version switching)
* API reference (paths & shapes)
* Project layout and file descriptions
* Local dev, Docker, and migrations (Alembic)
* Health checks, testing, and troubleshooting
* LLM integration surface (stubbed today; pluggable tomorrow)
* Hardening checklist (next steps)

---

## What we built

### Versioned resume builder

* Each **version** = one complete conversation snapshot + the current `resume` JSON.
* Switch versions, rename, autosave. Snapshots are saved as JSONB to Postgres 16.

### Frontend (Vite/React)

* Chat-first UI with widgets. User input → compute “changes” → reducer updates state → autosave full snapshot to the selected version.
* On mount: fetch versions; if none, create one; load snapshot into reducer with `resetTo(payload)`.
* Autosave writes the entire reducer snapshot back to the server on change (debounced).

### Backend (FastAPI + SQLAlchemy + Pydantic v2 + Postgres)

* Minimal REST API for versions (list/create/get/rename/replace).
* JSONB storage; indexes for fast listing and future filtering.
* CORS wide-open in dev (configurable).
* **Robustness additions**:

  * **Settings** via `pydantic-settings` (Pydantic v2 compliant).
  * **Structured JSON logging** to stdout.
  * **Lifespan DB ping** + `/api/health/live` and `/api/health/ready`.
  * **Payload validation** with a `Snapshot` schema (reject malformed payloads).
  * **Alembic** migrations wired to read `DATABASE_URL` from env (no brittle INI interpolation).
  * **LLM router** behind a provider interface (safe stub today). Guarded import so LLM issues can’t crash the API.

---

## Tech stack (locked-in)

**Backend**

* FastAPI
* SQLAlchemy **2.0.x**
* Pydantic **2.9.x**
* **pydantic-settings** **2.6.x**
* Postgres **16** (JSONB)
* Alembic **1.13.x**
* Redis present but **unused** today

**Frontend**

* React 18 + Vite
* Nginx serves built frontend at `/frontend/dist`
* Minimal custom state layer (no Redux)

**Infra**

* Docker Compose
* API exposed locally at `127.0.0.1:8002` → container port `8000`
* Frontend served at `127.0.0.1:3102`

---

## Data model

### Postgres schema

Single table: `versions`

```sql
CREATE TABLE versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'user',
  name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-update updated_at on UPDATE (installed during DB init)
CREATE INDEX idx_versions_user_created_desc ON versions (user_id, created_at DESC);
CREATE INDEX idx_versions_name ON versions (name);

-- Robustness (added): JSONB GIN for future payload queries
CREATE INDEX IF NOT EXISTS versions_payload_gin ON versions USING GIN (payload);
```

Notes:

* `user_id` is fixed `'user'` for now (auth later).
* We persist **both** the derived `resume` and the conversation snapshot for reliability.

### Snapshot/Resume JSON shape (server-validated)

```json
{
  "resume": {
    "contact": {
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phone": "string",
      "links": [
        {"linkName": "string", "link": "string"}
      ]
    },
    "summary": "string",
    "skills": ["string"],
    "sections": [
      {
        "id": "string",
        "name": "string",
        "fields": ["string"],
        "items": [
          {
            "id": "string",
            "fields": { "key": "value" },
            "bullets": ["string"]
          }
        ]
      }
    ],
    "meta": { "format": "resume-v2", "version": 2, "locale": "en-US" }
  },
  "states": [ { "...": "..." } ],
  "activeStateId": "string | null",
  "autosaveStateId": "string | null",
  "userTurns": [ { "...": "..." } ],
  "step": 0
}
```

This structure is enforced on writes (`POST /api/versions`, `PUT /api/versions/:id`) by `payload_models.Snapshot` so malformed payloads fail fast with `422`.

---

## Frontend architecture

### Top-level flow

1. **App bootstrap (`frontend/src/main.jsx`):** mounts `<App/>`.
2. **App initialization (`frontend/src/App.jsx`):**

   * `GET /api/versions`:

     * If empty → `POST /api/versions {}` to create a seed.
     * Select the first (or last used) version.
   * Load the selected version’s **`payload`** into the reducer via `conv.resetTo(payload)`.
3. **Editing:**

   * **`ChatPanel.jsx`** renders the current step’s widgets.
   * User input → build a `changes` object (widget-driven).
   * Call `conv.submitStep(changes, stepDef.widgets, inputs)`.
   * Reducer updates `resume`, `states`, `userTurns`, `step`, etc.
4. **Autosave:**

   * On any reducer state change, debounce and `PUT /api/versions/:id {payload: conv.snapshot()}`.
   * Snapshot is a **complete, serializable** copy; server replaces `payload` atomically.

### State management (`frontend/src/state`)

* **`useConversation.js`** (custom reducer hook)

  * Holds:

    * `resume` – structured resume object
    * `states` – history of snapshots (for undo/redo or analysis)
    * `userTurns` – chat turn log
    * `activeStateId` / `autosaveStateId`
    * `step` – index into the flow
  * Core actions:

    * `submitStep(changes, widgets, inputs)` – apply widget changes to `resume` and/or conversation state.
    * `undo()` – revert to previous snapshot (if implemented in your reducer).
    * `advanceNoop()` – move forward without changes.
    * `resetTo(payload)` – replace the entire reducer state from a server payload.
    * `snapshot()` – return a deep-copied, minimal JSON suitable for the API.
  * **Guard rails** you’ve already encoded:

    * Avoids deep copy errors (`JSON.parse(undefined)`).
    * Ensures objects exist before serialization.

### Components (`frontend/src/components`)

* **`VersionsBar.jsx`**

  * Dropdown to select versions.
  * “Rename” calls `PATCH /api/versions/:id/rename`.
  * “New +” calls `POST /api/versions` then `resetTo(payload)`.
* **`ChatPanel.jsx`**

  * Orchestrates widget rendering for the current step.
  * Translates inputs → `changes` → `conv.submitStep(...)`.
* **Other UI** (resume preview, editable forms)

  * Current WIP: display the structured `resume` and provide form fields around it; later you’ll refine this and add ready-made education/experience sections.

### Frontend API client (`frontend/src/api`)

* Thin wrappers around:

  * `GET /api/versions`
  * `POST /api/versions`
  * `GET /api/versions/:id`
  * `PATCH /api/versions/:id/rename`
  * `PUT /api/versions/:id`
* Typically implemented with `fetch` (or a tiny wrapper) and JSON parsing.
* Errors bubble up to toast or inline messages.

### Environment & build

* **Build metadata:** the build script injects

  * `VITE_BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)`
  * `VITE_GIT_SHA=$(git rev-parse --short HEAD || echo unknown)`
* **Nginx** serves **static files** from `/frontend/dist`; the API runs on a separate port (`8002` host → `8000` container).
* **Local dev:** run everything via Docker Compose; for hot-reload frontend you can `npm run dev` locally if you map ports, but current workflow favors dockerized builds.

### Autosave details (frontend ↔ backend)

* The reducer exposes `snapshot()` which returns a **complete** payload the server expects.
* App uses a **debounce** (common pattern \~500–1000 ms) to avoid spamming writes.
* On successful `PUT`, UI may optionally update `autosaveStateId`/`updated_at` ribbon.

---

## API (paths & shapes)

Base URL (local): `http://127.0.0.1:8002`

### Health

* `GET /api/health/live` → `{"status":"ok"}`
* `GET /api/health/ready` → DB ping

### Ping

* `GET /api/ping` → `{"status":"ok"}`

### Versions

* `GET /api/versions` → `[{id,name,created_at,updated_at}]`

* `POST /api/versions` body: optional `{name, payload?}` (also accepts legacy `data`)
  → `{id,name,created_at,updated_at,payload}`
  If no name, server generates `user-YYMMDD-HHMMSS`.
  If no payload, server seeds a default resume/snapshot.

* `GET /api/versions/:id`
  → `{id,name,created_at,updated_at,payload}`

* `PATCH /api/versions/:id/rename` body: `{name}`
  → `{id,name,created_at,updated_at}`

* `PUT /api/versions/:id` body: `{payload}` (or `{data}`; `payload` preferred)
  → `{id,name,created_at,updated_at,payload}` (replaces entire payload)

### LLM (stub; pluggable later)

* `POST /api/llm/complete` body: `{prompt: string}`
  → `{provider: "null" | "openai" | "gemini", output: string}`
  Today returns `[LLM disabled] echo: ...`. Code path is in place for future providers.

---

## Project layout & file descriptions

```
api/
  app/
    __init__.py
    db.py                 # SQLAlchemy engine + session + init_db()
    logging_setup.py      # JSON logs to stdout
    main.py               # FastAPI app, routes, lifespan, health, guarded LLM include
    models.py             # SQLAlchemy models (Version, etc.)
    payload_models.py     # Pydantic v2 schema for Snapshot payload validation
    schemas.py            # Pydantic v2 I/O schemas
    settings.py           # pydantic-settings config: ENV, DB URL, CORS, LLM keys
    llm/
      __init__.py
      providers.py        # LLMProvider interface + NullProvider (stub)
      routes.py           # /api/llm/complete (safe echo today)
  alembic.ini             # Alembic config (script_location = migrations)
  migrations/
    env.py                # Reads DATABASE_URL from env; sys.path fix; online/offline modes
    versions/
      0001_baseline_stamp.py   # stamp (no-op)
      0002_gin_payload.py      # GIN index on versions.payload
  requirements.txt        # includes pydantic-settings, alembic, etc.

frontend/
  dist/                   # built assets (served by nginx)
  index.html              # dev entry (Vite)
  nginx.conf              # nginx vhost for static frontend
  node_modules/           # dependencies
  package.json            # scripts: build/dev
  package-lock.json
  src/
    api/                  # fetch helpers for versions API
    app.css               # base styles
    App.jsx               # bootstraps versions load/create; mounts ChatPanel + VersionsBar
    components/
      ChatPanel.jsx       # renders step widgets; computes `changes`; calls submitStep()
      VersionsBar.jsx     # switch/rename/create versions; triggers network calls
      (...other UI...)    # future: resume preview, editable forms
    lib/                  # shared helpers (ids, formatting, widget helpers)
    main.jsx              # React entry, mounts <App/>
    state/
      useConversation.js  # reducer: resume, states, userTurns, step, resetTo(), snapshot()
  vite.config.js          # Vite build config (env vars, base path)

docker-compose.yml        # services: db, api, web (nginx)
public/
  index.html              # public assets (if any)
README.md                 # this file
```

---

## Environment & configuration

Split env files:

* `.env.db`

  ```
  POSTGRES_USER=puma
  POSTGRES_PASSWORD=password
  POSTGRES_DB=puma_v2
  ```

* `.env.api`

  ```
  DATABASE_URL=postgresql+psycopg://puma:password@db:5432/puma_v2
  REDIS_URL=redis://redis:6379/0
  OPENAI_API_KEY=key
  GEMINI_API_KEY=key
  # Optional later:
  # CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
  # DEFAULT_LLM_PROVIDER=openai|gemini|null  (defaults to null)
  ```

**Frontend build metadata** (in the build script you’re already using):

* `VITE_BUILD_TIME` and `VITE_GIT_SHA` baked into the bundle; use from `import.meta.env`.

---

## Build, run, and migrate

### First run (or after dependency edits)

```bash
# From repo root
sudo docker compose -p puma_v2 up -d --build
```

**Apply migrations**:

```bash
docker compose -p puma_v2 exec api alembic -c /app/alembic.ini upgrade head
```

### Health checks

```bash
curl -s http://127.0.0.1:8002/api/health/live
curl -s http://127.0.0.1:8002/api/health/ready
```

### Quick API smoke

```bash
curl -s http://127.0.0.1:8002/api/ping
curl -s http://127.0.0.1:8002/api/versions
curl -s -X POST http://127.0.0.1:8002/api/versions -H 'Content-Type: application/json' -d '{}'
VID=$(curl -s http://127.0.0.1:8002/api/versions | jq -r '.[0].id')
curl -s http://127.0.0.1:8002/api/versions/$VID | jq '.payload | keys'
```

### Frontend build & (re)deploy static assets

```bash
cd /srv/puma/v2/frontend
docker run --rm -v "$PWD":/app -w /app node:20-alpine sh -lc '
  apk add --no-cache git >/dev/null 2>&1 || true
  export VITE_BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  export VITE_GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  npm i && npm run build
'
cd /srv/puma/v2
sudo docker compose -p puma_v2 up -d --no-deps --force-recreate web
```

---

## Major server functions & flow

* **App startup** (`main.py`)

  * `setup_logging()` → JSON logs with env level.
  * `lifespan` handler pings DB: fails fast if DB unavailable.
  * Registers CORS (wide-open in dev; configurable).
  * Registers routes for ping, versions, health.
  * **Guarded** LLM router import — LLM failures won’t kill the app.

* **DB engine** (`db.py`)

  * `create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=10)`
  * `SessionLocal` + `get_db()` dependency.
  * `init_db()` for dev idempotent table creation.

* **Payload validation** (`payload_models.py`)

  * `Snapshot` Pydantic v2 model — validates POST/PUT payloads to prevent corrupt state.

* **Alembic env** (`migrations/env.py`)

  * Injects `DATABASE_URL` from environment (no brittle INI interpolation).
  * Ensures Python path includes the parent of `app/`.

* **LLM surface**

  * `llm/providers.py`: `LLMProvider` + `NullProvider`.
  * `llm/routes.py`: POST `/api/llm/complete` → provider.complete(prompt).

---

## Troubleshooting

**“No config file ‘…alembic.ini’ found”**
Run Alembic with the explicit config path:

```bash
docker compose -p puma_v2 exec api alembic -c /app/alembic.ini upgrade head
```

**`ModuleNotFoundError: No module named 'app'` during Alembic**

* We solve this in `migrations/env.py` by inserting `Path(__file__).resolve().parents[1]` into `sys.path`.

**`InterpolationMissingOptionError` for `%(DATABASE_URL)s`**

* We set `sqlalchemy.url` from `env.py` using `os.environ["DATABASE_URL"]`. Keep a placeholder in `alembic.ini`:

  ```ini
  [alembic]
  script_location = migrations
  sqlalchemy.url = postgresql://localhost/placeholder
  ```

**Pydantic v2: `BaseSettings` moved**

* Use `from pydantic_settings import BaseSettings` and add `pydantic-settings==2.6.0` to `api/requirements.txt`, then rebuild API.

**LLM import crashes app**

* Guarded import in `main.py` prevents crashes. If you see “LLM routes disabled: …” in logs, fix `app/llm/*` (the drop-in files above are safe).

**Frontend shows no data**

* Confirm API is reachable from the browser (CORS ok), `/api/versions` returns an array, and autosave `PUT` calls are succeeding (check devtools network tab).
* If hosting paths change, verify `vite.config.js` `base` matches Nginx location.

---

## How to add a new migration

```bash
# Change SQLAlchemy models first, then:
docker compose -p puma_v2 exec api alembic -c /app/alembic.ini revision --autogenerate -m "describe change"

# Review generated file under api/migrations/versions/*.py
docker compose -p puma_v2 exec api alembic -c /app/alembic.ini upgrade head
```

---

## Hardening checklist (next steps)

* [ ] **Production server config:** remove `--reload`, set `--workers 2` (or more) in Dockerfile/cmd for prod.
* [ ] **CORS:** use `settings.CORS_ORIGINS` instead of `*`; set origins in `.env.api`.
* [ ] **Uniqueness:** optional `UNIQUE (user_id, name)` on `versions` if names must be unique per user.
* [ ] **Payload size guard:** reject snapshots > \~500 KB (`413 Payload Too Large`).
* [ ] **Consistent errors:** global exception handler returning `{error:{code,msg}}`; include request id in logs.
* [ ] **Auth-ready schema:** create `users` table; make `versions.user_id` a FK; backfill `'user'`; keep `(user_id, created_at DESC)` index.
* [ ] **Observability:** request logging (path, status, latency); Sentry/OTEL later.
* [ ] **LLM providers:** implement `OpenAIProvider` / `GeminiProvider` with strict timeouts, retries/backoff, token usage metrics; keep guarded import.
* [ ] **Nginx timeouts/limits:** set sane body size (1–2 MB) and 30s proxy timeout for `/api/llm/*`.
* [ ] **CI smoke:** build API, `pip install -r requirements.txt`, `alembic upgrade --sql head`, and a tiny `pytest` that hits `/api/ping`.
* [ ] **Caching (future):** Redis for hot version lists or LLM result caching (TTL).
* [ ] **Security:** pin package versions, add Dependabot/GitHub alerts.

---
