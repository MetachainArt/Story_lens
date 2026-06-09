"""Provider adapters and orchestration helpers for AI image generation."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from html import escape
from pathlib import Path
from string import Formatter
from uuid import UUID, uuid4

import anyio
import httpx

from ..core.config import settings


UPLOAD_ROOT = (Path(__file__).resolve().parents[1] / "uploads" / "photos").resolve()


@dataclass(frozen=True)
class ImageProviderResult:
    image_url: str | None = None
    image_bytes: bytes | None = None
    mime_type: str = "image/png"
    provider_task_id: str | None = None
    metadata: dict[str, object] | None = None


class ImageProvider:
    name = "base"

    async def generate(
        self,
        *,
        prompt: str,
        source_image_url: str | None,
        options: dict[str, object],
    ) -> ImageProviderResult:
        raise NotImplementedError


class KieImageProvider(ImageProvider):
    name = "kie"

    async def generate(
        self,
        *,
        prompt: str,
        source_image_url: str | None,
        options: dict[str, object],
    ) -> ImageProviderResult:
        if not settings.KIE_API_KEY:
            return ImageProviderResult(metadata={"fallback": True, "reason": "missing_kie_key"})

        model = str(options.get("model") or settings.IMAGE_DEFAULT_MODEL or "gpt-image-2")
        kie_model = model if model.startswith("gpt-image") else "gpt-image-2"
        if source_image_url:
            kie_model = f"{kie_model}-image-to-image" if "image-to-image" not in kie_model else kie_model

        payload: dict[str, object] = {
            "model": kie_model,
            "input": {
                "prompt": prompt,
                "aspect_ratio": str(options.get("aspect_ratio") or "1:1"),
                "resolution": str(options.get("resolution") or "1K"),
            },
        }
        if source_image_url:
            payload["input"]["input_urls"] = [source_image_url]  # type: ignore[index]

        timeout = httpx.Timeout(float(settings.IMAGE_GENERATION_TIMEOUT_SECONDS), connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                "https://api.kie.ai/api/v1/jobs/createTask",
                headers={"Authorization": f"Bearer {settings.KIE_API_KEY}"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        task_id = str(data.get("data", {}).get("taskId") or data.get("taskId") or "")
        return ImageProviderResult(provider_task_id=task_id, metadata={"async_provider": True})


async def get_kie_task_result(task_id: str) -> tuple[str, str | None, str | None]:
    """Return (state, first_result_url, error_message) for a Kie market task."""
    if not settings.KIE_API_KEY:
        return "fail", None, "KIE_API_KEY is not configured"

    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            "https://api.kie.ai/api/v1/jobs/recordInfo",
            headers={"Authorization": f"Bearer {settings.KIE_API_KEY}"},
            params={"taskId": task_id},
        )
        response.raise_for_status()
        payload = response.json()

    data = payload.get("data") if isinstance(payload, dict) else {}
    if not isinstance(data, dict):
        return "fail", None, "Invalid Kie task response"

    state = str(data.get("state") or "").lower()
    if state == "success":
        result_json = data.get("resultJson")
        result_urls: list[str] = []
        if isinstance(result_json, str) and result_json.strip():
            try:
                parsed = json.loads(result_json)
                raw_urls = parsed.get("resultUrls") if isinstance(parsed, dict) else None
                if isinstance(raw_urls, list):
                    result_urls = [url for url in raw_urls if isinstance(url, str)]
            except json.JSONDecodeError:
                pass
        return "success", (result_urls[0] if result_urls else None), None

    if state == "fail":
        return "fail", None, str(data.get("failMsg") or "Image generation failed")

    return state or "processing", None, None


class OpenAIImageProvider(ImageProvider):
    name = "openai"

    async def generate(
        self,
        *,
        prompt: str,
        source_image_url: str | None,
        options: dict[str, object],
    ) -> ImageProviderResult:
        if not settings.OPENAI_API_KEY:
            return ImageProviderResult(metadata={"fallback": True, "reason": "missing_openai_key"})

        model = str(options.get("model") or settings.IMAGE_DEFAULT_MODEL or "gpt-image-2")
        payload: dict[str, object] = {
            "model": model,
            "prompt": prompt,
            "size": str(options.get("size") or "1024x1024"),
        }
        timeout = httpx.Timeout(float(settings.IMAGE_GENERATION_TIMEOUT_SECONDS), connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        first = (data.get("data") or [{}])[0]
        if isinstance(first, dict) and isinstance(first.get("b64_json"), str):
            return ImageProviderResult(
                image_bytes=base64.b64decode(first["b64_json"]),
                mime_type="image/png",
                metadata={"usage": data.get("usage")},
            )
        if isinstance(first, dict) and isinstance(first.get("url"), str):
            return ImageProviderResult(image_url=first["url"], metadata={"usage": data.get("usage")})
        return ImageProviderResult(metadata={"fallback": True, "reason": "empty_openai_response"})


def get_image_provider(provider_name: str | None = None) -> ImageProvider:
    provider = (provider_name or settings.IMAGE_PROVIDER or "kie").strip().lower()
    if provider == "openai":
        return OpenAIImageProvider()
    return KieImageProvider()


def render_prompt(template: str, values: dict[str, object]) -> str:
    safe_values = {key: str(value).strip() for key, value in values.items()}
    names = [field_name for _, field_name, _, _ in Formatter().parse(template) if field_name]
    for name in names:
        safe_values.setdefault(name, "")
    return template.format_map(_DefaultMap(safe_values)).strip()


class _DefaultMap(dict[str, str]):
    def __missing__(self, key: str) -> str:
        return ""


async def persist_generated_image(
    *,
    user_id: UUID,
    prompt: str,
    result: ImageProviderResult,
) -> str:
    user_dir = UPLOAD_ROOT / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    if result.image_url and result.image_url.startswith(("http://", "https://")):
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(result.image_url)
            response.raise_for_status()
            image_bytes = response.content
            content_type = response.headers.get("content-type", "image/png")
    elif result.image_bytes:
        image_bytes = result.image_bytes
        content_type = result.mime_type
    else:
        image_bytes = _build_placeholder_svg(prompt).encode("utf-8")
        content_type = "image/svg+xml"

    extension = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
    }.get(content_type.split(";", 1)[0].lower(), ".png")

    filename = f"{uuid4()}{extension}"
    path = user_dir / filename
    async with await anyio.open_file(path, "wb") as file:
        await file.write(image_bytes)
    return f"/uploads/photos/{user_id}/{filename}"


def _build_placeholder_svg(prompt: str) -> str:
    short = escape(prompt[:180])
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs>
  <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
    <stop stop-color="#FFE6C7"/>
    <stop offset="0.55" stop-color="#DFF4EE"/>
    <stop offset="1" stop-color="#F7C7D9"/>
  </linearGradient>
</defs>
<rect width="1024" height="1024" fill="url(#bg)"/>
<circle cx="210" cy="220" r="86" fill="#FFF8F0" opacity=".75"/>
<circle cx="820" cy="250" r="120" fill="#FFFFFF" opacity=".5"/>
<rect x="116" y="650" width="792" height="190" rx="48" fill="#FFF8F0" opacity=".86"/>
<text x="512" y="440" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="800" fill="#6D4B3A">Story Lens</text>
<text x="512" y="545" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#7B6658">AI image preview</text>
<foreignObject x="170" y="690" width="684" height="110">
  <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;font-size:28px;line-height:1.35;color:#5F4A3A;text-align:center">{short}</div>
</foreignObject>
</svg>"""
