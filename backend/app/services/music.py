"""Kie.ai Suno API integration for AI music generation."""

import logging
import os
from typing import Final
from uuid import uuid4

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

KIE_BASE_URL: Final[str] = "https://api.kie.ai"
GENERATE_ENDPOINT: Final[str] = f"{KIE_BASE_URL}/api/v1/generate"
STATUS_ENDPOINT: Final[str] = f"{KIE_BASE_URL}/api/v1/generate/record-info"

MOOD_STYLE_MAP: Final[dict[str, str]] = {
    "잔잔한": "Soft piano, calm ambient, gentle acoustic, peaceful melody",
    "밝은": "Bright pop, cheerful ukulele, upbeat acoustic, happy rhythm",
    "서정적": "Emotional strings, lyrical piano, cinematic, heartfelt ballad",
    "신나는": "Energetic pop, fun percussion, lively tempo, uplifting beat",
    "몽환적": "Dreamy synth, ethereal pads, ambient textures, soft reverb",
    "따뜻한": "Warm acoustic guitar, cozy folk, gentle fingerpicking, comforting",
    "그리운": "Nostalgic melody, bittersweet piano, wistful strings, melancholic beauty",
    "용감한": "Inspiring orchestral, bold brass, triumphant drums, heroic theme",
}

SUPPORTED_MOODS: Final[tuple[str, ...]] = tuple(MOOD_STYLE_MAP.keys())


def build_music_prompt(
    topic: str,
    mood: str,
    draft_text: str,
) -> tuple[str, str, bool]:
    """Build a Suno prompt from the photo's topic, mood, and written text.

    If draft_text is provided, it becomes the lyrics (instrumental=False).
    Otherwise, generates an instrumental piece.

    Returns (prompt, style, instrumental) tuple.
    """
    style = MOOD_STYLE_MAP.get(mood, MOOD_STYLE_MAP["잔잔한"])

    # If user wrote text, use it as lyrics
    if draft_text.strip():
        lyrics = draft_text.strip()[:3000]
        return lyrics, style, False

    # No text → instrumental
    prompt_parts = []
    if topic.strip():
        prompt_parts.append(f"A short instrumental piece inspired by the theme '{topic}'.")
    else:
        prompt_parts.append("A short instrumental background music piece.")
    prompt_parts.append(f"Style: {mood}. Keep it under 2 minutes, suitable as background music for a photo story.")

    return " ".join(prompt_parts), style, True


CALLBACK_URL: Final[str] = "https://api.storylens.dmssolution.co.kr/api/v1/music/callback"


async def generate_music(
    topic: str,
    mood: str,
    draft_text: str,
) -> dict:
    """Start a music generation task via Kie.ai Suno API.

    Returns {"task_id": str} on success.
    Raises ValueError if API key is missing.
    Raises httpx.HTTPStatusError on API errors.
    """
    if not settings.KIE_API_KEY:
        raise ValueError("KIE_API_KEY is not configured")

    prompt, style, use_instrumental = build_music_prompt(topic, mood, draft_text)

    payload = {
        "prompt": prompt,
        "customMode": True,
        "instrumental": use_instrumental,
        "model": settings.KIE_SUNO_MODEL,
        "style": style,
        "title": f"{topic or 'Story'} - {mood}",
        "callBackUrl": CALLBACK_URL,
    }

    headers = {
        "Authorization": f"Bearer {settings.KIE_API_KEY}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(GENERATE_ENDPOINT, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    if data.get("code") != 200:
        logger.error("Kie.ai generate error: %s", data.get("msg"))
        raise ValueError(data.get("msg", "Music generation failed"))

    task_id = data.get("data", {}).get("taskId")
    if not task_id:
        raise ValueError("No taskId in response")

    logger.info("Music generation started: taskId=%s", task_id)
    return {"task_id": task_id}


async def check_music_status(task_id: str) -> dict:
    """Check the status of a music generation task.

    Returns dict with status, and audio data if complete.
    """
    if not settings.KIE_API_KEY:
        raise ValueError("KIE_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {settings.KIE_API_KEY}",
    }

    timeout = httpx.Timeout(15.0, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            STATUS_ENDPOINT,
            params={"taskId": task_id},
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()

    if data.get("code") != 200:
        return {"status": "error", "message": data.get("msg", "Unknown error")}

    task_data = data.get("data", {})
    status = task_data.get("status", "PENDING")

    result: dict = {"status": status, "task_id": task_id}

    if status == "SUCCESS":
        suno_data = (
            task_data.get("response", {}).get("sunoData", [])
            if isinstance(task_data.get("response"), dict)
            else []
        )
        tracks = []
        for track in suno_data:
            if isinstance(track, dict) and track.get("audioUrl"):
                tracks.append({
                    "id": track.get("id", ""),
                    "audio_url": track["audioUrl"],
                    "stream_url": track.get("streamAudioUrl", ""),
                    "image_url": track.get("imageUrl", ""),
                    "title": track.get("title", ""),
                    "duration": track.get("duration", 0),
                    "tags": track.get("tags", ""),
                })
        result["tracks"] = tracks

    elif status in ("CREATE_TASK_FAILED", "GENERATE_AUDIO_FAILED", "SENSITIVE_WORD_ERROR"):
        result["message"] = task_data.get("errorMessage", "Generation failed")

    return result


MUSIC_UPLOAD_DIR: Final[str] = "uploads/music"


async def download_music_file(audio_url: str, photo_id: str) -> str:
    """Download an audio file from Kie.ai and save it to our server.

    Returns the local URL path (e.g. /uploads/music/{photo_id}/{uuid}.mp3).
    Raises ValueError on download failure.
    """
    save_dir = os.path.join(MUSIC_UPLOAD_DIR, photo_id)
    os.makedirs(save_dir, exist_ok=True)

    filename = f"{uuid4()}.mp3"
    file_path = os.path.join(save_dir, filename)

    timeout = httpx.Timeout(60.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(audio_url)
            response.raise_for_status()

            with open(file_path, "wb") as f:
                f.write(response.content)

    except (httpx.HTTPError, OSError) as exc:
        logger.error("Failed to download music from %s: %s", audio_url, exc)
        # Clean up partial file
        try:
            os.remove(file_path)
        except OSError:
            pass
        raise ValueError(f"Music download failed: {exc}") from exc

    local_url = f"/uploads/music/{photo_id}/{filename}"
    logger.info("Music downloaded: %s -> %s", audio_url, local_url)
    return local_url
