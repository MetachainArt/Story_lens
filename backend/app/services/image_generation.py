"""Provider adapters and orchestration helpers for AI image generation."""

from __future__ import annotations

import base64
import json
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from string import Formatter
from uuid import UUID, uuid4

import anyio
import httpx

from ..core.config import settings


UPLOAD_ROOT = (Path(__file__).resolve().parents[1] / "uploads" / "photos").resolve()
KIE_UPLOAD_ROOT = "https://kieai.redpandaai.co/api/file-stream-upload"


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

    async def _upload_reference_file(self, source_image_path: str) -> str:
        path = Path(source_image_path).resolve()
        if not path.is_file():
            raise RuntimeError("Reference image file was not found")

        mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
        async with await anyio.open_file(path, "rb") as file:
            image_bytes = await file.read()

        timeout = httpx.Timeout(60.0, connect=10.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                KIE_UPLOAD_ROOT,
                headers={"Authorization": f"Bearer {settings.KIE_API_KEY}"},
                data={"uploadPath": "images/story-lens"},
                files={"file": (path.name, image_bytes, mime_type)},
            )
            response.raise_for_status()
            payload = response.json()

        data = payload.get("data") if isinstance(payload, dict) else {}
        if not isinstance(data, dict):
            raise RuntimeError("Kie file upload returned an invalid response")

        uploaded_url = data.get("downloadUrl") or data.get("fileUrl")
        if not isinstance(uploaded_url, str) or not uploaded_url.startswith(("http://", "https://")):
            raise RuntimeError("Kie file upload returned no usable file URL")
        return uploaded_url

    async def generate(
        self,
        *,
        prompt: str,
        source_image_url: str | None,
        options: dict[str, object],
    ) -> ImageProviderResult:
        if not settings.KIE_API_KEY:
            raise RuntimeError("KIE_API_KEY is not configured")

        source_image_path = options.get("_source_image_file_path")
        if isinstance(source_image_path, str) and source_image_path:
            source_image_url = await self._upload_reference_file(source_image_path)

        model = str(options.get("model") or settings.IMAGE_DEFAULT_MODEL or "gpt-image-2")
        kie_model = model if model.startswith("gpt-image") else "gpt-image-2"
        if source_image_url:
            kie_model = f"{kie_model}-image-to-image" if "image-to-image" not in kie_model else kie_model

        input_payload: dict[str, object] = {
            "prompt": prompt,
            "aspect_ratio": str(options.get("aspect_ratio") or "1:1"),
            "resolution": str(options.get("resolution") or "1K"),
        }
        if source_image_url:
            input_payload["input_urls"] = [source_image_url]

        payload: dict[str, object] = {
            "model": kie_model,
            "input": input_payload,
        }

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
        if not task_id:
            raise RuntimeError("Kie did not return a task id")
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
            raise RuntimeError("OPENAI_API_KEY is not configured")
        if source_image_url:
            raise RuntimeError("OpenAI reference-image generation is not configured for this flow")

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
        raise RuntimeError("OpenAI returned no image data")


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
        raise ValueError("Provider returned no image data")

    extension = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }.get(content_type.split(";", 1)[0].lower(), ".png")

    filename = f"{uuid4()}{extension}"
    path = user_dir / filename
    async with await anyio.open_file(path, "wb") as file:
        await file.write(image_bytes)
    return f"/uploads/photos/{user_id}/{filename}"
