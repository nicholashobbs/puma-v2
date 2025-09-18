# api/app/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone
from typing import List

from .db import init_db, get_db
from . import models, schemas

# --- added imports for robustness ---
from sqlalchemy import text
from contextlib import asynccontextmanager
from .db import engine
from .settings import get_settings
from .logging_setup import setup_logging
# from .llm.routes import router as llm_router
from .payload_models import Snapshot
# ------------------------------------

settings = get_settings()
setup_logging()

@asynccontextmanager
async def lifespan(app):
    # DB ping at startup for readiness
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    yield

app = FastAPI(title="Puma v2 API", version="0.1.0", lifespan=lifespan)

# CORS: keep wide-open for dev; make configurable later via settings.CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.get("/api/ping")
def ping():
    return {"status": "ok"}

# Ensure DB tables exist at startup
init_db()

# --- helpers from your original app (seed + naming) ---
def default_name() -> str:
    now = datetime.now(timezone.utc)
    return "user-" + now.strftime("%y%m%d-%H%M%S")

def default_payload() -> dict:
    # A minimal, safe default payload; your frontend lib/resumeSeed.js mirrors this
    return {
        "resume": {
            "contact": {
                "firstName": "Ava",
                "lastName": "Nguyen",
                "email": "ava@example.com",
                "phone": "",
                "links": []
            },
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
                            "fields": {"title": "Software Engineer", "company": "Acme", "location": "Denver, CO", "dates": "2022–Present"},
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
                            "fields": {"school": "University of Somewhere", "degree": "", "location": "Somewhere, USA", "date": "2020"},
                            "bullets": []
                        }
                    ]
                }
            ],
            "meta": {"format": "resume-v2", "version": 2, "locale": "en-US"}
        },
        "states": [],
        "activeStateId": None,
        "autosaveStateId": None,
        "userTurns": [],
        "step": 0
    }
# ------------------------------------------------------

@app.get("/api/versions", response_model=List[schemas.VersionShort])
def list_versions(db: Session = Depends(get_db)):
    rows = db.query(models.Version).order_by(models.Version.created_at.desc()).all()
    return [
        schemas.VersionShort(
            id=row.id, name=row.name, created_at=row.created_at, updated_at=row.updated_at
        )
        for row in rows
    ]

@app.post("/api/versions", response_model=schemas.VersionOut)
def create_version(body: schemas.VersionCreate = schemas.VersionCreate(), db: Session = Depends(get_db)):
    name = body.name or default_name()
    data = body.payload or body.data or default_payload()
    # validate payload to prevent corrupt snapshots
    Snapshot.model_validate(data)

    row = models.Version(name=name, payload=data)
    db.add(row)
    db.commit()
    db.refresh(row)
    return schemas.VersionOut(
        id=row.id, name=row.name, created_at=row.created_at, updated_at=row.updated_at, payload=row.payload
    )

@app.get("/api/versions/{version_id}", response_model=schemas.VersionOut)
def get_version(version_id: UUID, db: Session = Depends(get_db)):
    row = db.query(models.Version).filter(models.Version.id == version_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    return schemas.VersionOut(
        id=row.id, name=row.name, created_at=row.created_at, updated_at=row.updated_at, payload=row.payload
    )

@app.patch("/api/versions/{version_id}/rename", response_model=schemas.VersionShort)
def rename_version(version_id: UUID, body: schemas.VersionRename, db: Session = Depends(get_db)):
    row = db.query(models.Version).filter(models.Version.id == version_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    row.name = body.name
    db.add(row)
    db.commit()
    db.refresh(row)
    return schemas.VersionShort(
        id=row.id, name=row.name, created_at=row.created_at, updated_at=row.updated_at
    )

@app.put("/api/versions/{version_id}", response_model=schemas.VersionOut)
def replace_version_data(version_id: UUID, body: schemas.VersionReplace, db: Session = Depends(get_db)):
    row = db.query(models.Version).filter(models.Version.id == version_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    data = body.payload or body.data
    # validate payload to prevent corrupt snapshots
    Snapshot.model_validate(data)

    row.payload = data
    db.add(row)
    db.commit()
    db.refresh(row)
    return schemas.VersionOut(
        id=row.id, name=row.name, created_at=row.created_at, updated_at=row.updated_at, payload=row.payload
    )

# Health endpoints for Docker/K8s probes
@app.get("/api/health/live", tags=["health"])
def live():
    return {"status": "ok"}

@app.get("/api/health/ready", tags=["health"])
def ready():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ready"}

# LLM router (stub provider for now)
#app.include_router(llm_router)
# LLM router (guarded so API starts even if the LLM module errors at import time)
try:
    from .llm.routes import router as llm_router
    app.include_router(llm_router)
except Exception as e:
    import logging
    logging.getLogger(__name__).warning("LLM routes disabled: %s", e)
