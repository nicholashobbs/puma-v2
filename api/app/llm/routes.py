from fastapi import APIRouter
from .providers import get_provider
from ..settings import get_settings

router = APIRouter(prefix="/api/llm", tags=["llm"])
settings = get_settings()

@router.post("/complete")
async def llm_complete(body: dict):
    prompt = body.get("prompt", "")
    provider = get_provider()
    out = await provider.complete(prompt=prompt)
    return {"provider": settings.DEFAULT_LLM_PROVIDER, "output": out}
