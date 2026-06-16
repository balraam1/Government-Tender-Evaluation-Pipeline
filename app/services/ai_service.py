"""
AI Service Layer
Primary: Gemma via Ollama (local, on-prem)
Fallback: Gemini API
"""
import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIUnavailableError(Exception):
    """Raised when both Ollama and Gemini are unreachable or return empty responses."""
    pass


class AIService:
    def __init__(self):
        self.ollama_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL
        self.gemini_key = settings.GEMINI_API_KEY
        self.gemini_model = settings.GEMINI_MODEL

    async def generate(self, prompt: str, system_prompt: str = "", max_tokens: int = 2048, force_gemini: bool = False) -> str:
        """
        Main entry point. Tries Ollama first, falls back to Gemini.
        Raises AIUnavailableError if both backends fail — never returns fake/mock content.
        """
        if force_gemini:
            try:
                res = await self._gemini_generate(prompt, system_prompt, max_tokens)
                if not res or not res.strip():
                    raise ValueError("Empty response from Gemini")
                return res
            except httpx.HTTPStatusError as e:
                logger.error(f"Forced Gemini failed (HTTP {e.response.status_code}): {e.response.text}")
                raise AIUnavailableError(
                    f"Gemini API error ({e.response.status_code}): {e.response.text}"
                ) from e
            except Exception as e:
                logger.error(f"Forced Gemini failed: {e}")
                raise AIUnavailableError(f"Gemini unavailable: {e}") from e

        ollama_error = None
        try:
            res = await self._ollama_generate(prompt, system_prompt, max_tokens)
            if not res or not res.strip():
                raise ValueError("Empty response from Ollama")
            return res
        except Exception as e:
            ollama_error = e
            logger.warning(f"Ollama unavailable: {e}. Falling back to Gemini...")

        try:
            res = await self._gemini_generate(prompt, system_prompt, max_tokens)
            if not res or not res.strip():
                raise ValueError("Empty response from Gemini")
            return res
        except Exception as ge:
            logger.error(f"Both AI backends failed. Ollama: {ollama_error} | Gemini: {ge}")
            raise AIUnavailableError(
                f"All AI backends are unavailable. "
                f"Ollama error: {ollama_error} | Gemini error: {ge}"
            ) from ge

    async def _ollama_generate(self, prompt: str, system_prompt: str, max_tokens: int) -> str:
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        payload = {
            "model": self.ollama_model,
            "prompt": full_prompt,
            "stream": False,
            "options": {"num_predict": max_tokens}
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{self.ollama_url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    async def _gemini_generate(self, prompt: str, system_prompt: str, max_tokens: int) -> str:
        from dotenv import dotenv_values
        env_vars = dotenv_values(".env")
        current_key = env_vars.get("GEMINI_API_KEY", self.gemini_key)
        current_model = env_vars.get("GEMINI_MODEL", self.gemini_model)
        if not current_key:
            raise ValueError("GEMINI_API_KEY not configured")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{current_model}:generateContent?key={current_key}"
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": system_prompt}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will follow these instructions."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        payload = {
            "contents": contents,
            "generationConfig": {"maxOutputTokens": max_tokens}
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]


ai_service = AIService()
