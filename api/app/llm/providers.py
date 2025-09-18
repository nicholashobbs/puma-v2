from ..settings import get_settings

settings = get_settings()

class LLMProvider:
    async def complete(self, prompt: str, **kwargs) -> str:
        raise NotImplementedError

class NullProvider(LLMProvider):
    async def complete(self, prompt: str, **kwargs) -> str:
        return f"[LLM disabled] echo: {prompt[:200]}"

def get_provider() -> LLMProvider:
    name = (settings.DEFAULT_LLM_PROVIDER or "null").lower()
    # TODO: later: if name == "openai": return OpenAIProvider()
    # TODO: later: if name == "gemini": return GeminiProvider()
    return NullProvider()
