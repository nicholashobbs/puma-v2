import os
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import redis
from .db import SessionLocal, init_db
from . import models, schemas

app = FastAPI(title="Puma v2 API")

# If you ever hit API directly from a different origin in dev:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3102", "https://v2.puma.city"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/api/ping")
def ping():
    return {"status": "ok"}

@app.post("/api/items", response_model=schemas.ItemOut)
def create_item(item: schemas.ItemIn, db: Session = Depends(get_db)):
    m = models.Item(name=item.name)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "name": m.name}

@app.get("/api/items")
def list_items(db: Session = Depends(get_db)):
    return [{"id": i.id, "name": i.name} for i in db.query(models.Item).all()]

@app.get("/api/cache/hit")
def cache_hit():
    count = r.incr("hits")
    return {"hits": count}

@app.post("/api/llm/echo")
def llm_echo(payload: dict):
    # Placeholder for calling OpenAI/Gemini APIs with your keys (put in .env.api)
    return {"echo": payload.get("prompt", "")}
