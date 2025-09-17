# api/app/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone
from typing import List

from .db import init_db, get_db
from . import models, schemas

app = FastAPI(title="Puma v2 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

# ---------- Defaults shaped like the FE expects ----------

def default_resume() -> dict:
    return {
        "resume": {
            "contact": {"firstName": "Ava", "lastName": "Nguyen", "email": "", "phone": "", "links": []},
            "summary": "",
            "skills": [],
            "sections": [
                {
                    "id": "sec_experience",
                    "name": "Experience",
                    "fields": ["title", "company", "location", "dates"],
                    "items": [
                        {
                            "id": "itm_exp_1",
                            "fields": {
                                "title": "Senior Engineer",
                                "company": "Acme",
                                "location": "Denver, CO",
                                "dates": "2022–Present",
                            },
                            "bullets": [],
                        }
                    ],
                },
                {
                    "id": "sec_education",
                    "name": "Education",
                    "fields": ["school", "degree", "location", "date"],
                    "items": [
                        {
                            "id": "itm_edu_1",
                            "fields": {"school": "University of Somewhere", "degree": "", "location": "Somewhere, USA", "date": "2020"},
                            "bullets": [],
                        }
                    ],
                },
            ],
            "meta": {"format": "resume-v2", "version": 2, "locale": "en-US"},
        }
    }

def default_payload() -> dict:
    # Mirror useConversation.initialConv() structure exactly.
    resume_doc = default_resume()
    now_iso = datetime.now(timezone.utc).isoformat()
    snap = {
        "stateId": "st_init",
        "parentStateId": None,
        "createdAt": now_iso,
        "snapshotJson": resume_doc
    }
    return {
        "resume": resume_doc,
        "states": [snap],
        "activeStateId": snap["stateId"],
        "autosaveStateId": snap["stateId"],
        "userTurns": [],
        "step": 0
    }

def default_name() -> str:
    now = datetime.now(timezone.utc)
    return f"user-{now.strftime('%y%m%d-%H%M%S')}"

# ---------- Health ----------

@app.get("/api/ping")
def ping():
    return {"status": "ok"}

# ---------- Versions CRUD ----------

@app.get("/api/versions", response_model=List[schemas.VersionShort])
def list_versions(db: Session = Depends(get_db)):
    rows = db.query(models.Version).order_by(models.Version.created_at.desc()).all()
    return rows

@app.post("/api/versions", response_model=schemas.VersionOut)
def create_version(body: schemas.VersionCreate = schemas.VersionCreate(), db: Session = Depends(get_db)):
    name = body.name or default_name()
    data = body.payload or body.data or default_payload()
    row = models.Version(name=name, payload=data)  # user_id stays null for now
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@app.get("/api/versions/{version_id}", response_model=schemas.VersionOut)
def get_version(version_id: UUID, db: Session = Depends(get_db)):
    row = db.get(models.Version, version_id)
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    return row

@app.patch("/api/versions/{version_id}/rename", response_model=schemas.VersionShort)
def rename_version(version_id: UUID, payload: schemas.VersionRename, db: Session = Depends(get_db)):
    row = db.get(models.Version, version_id)
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    row.name = payload.name
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@app.put("/api/versions/{version_id}", response_model=schemas.VersionOut)
def replace_version_data(version_id: UUID, body: schemas.VersionReplace, db: Session = Depends(get_db)):
    row = db.get(models.Version, version_id)
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    data = body.payload or body.data
    if data is None:
        raise HTTPException(status_code=400, detail="Missing payload")
    row.payload = data
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
