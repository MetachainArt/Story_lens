"""Kie.ai Suno API integration for AI music generation."""

import logging
import os
from typing import Final, cast
from uuid import uuid4

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)

KIE_BASE_URL: Final[str] = "https://api.kie.ai"
GENERATE_ENDPOINT: Final[str] = f"{KIE_BASE_URL}/api/v1/generate"
STATUS_ENDPOINT: Final[str] = f"{KIE_BASE_URL}/api/v1/generate/record-info"

DEFAULT_STYLE: Final[str] = "발라드"

STYLE_PROMPT_MAP: Final[dict[str, str]] = {
    "발라드": "Korean ballad, emotional piano, warm strings, heartfelt melody",
    "재즈": "Jazz trio, brushed drums, upright bass, mellow piano, cozy groove",
    "힙합": "Korean hip-hop, laid-back beat, warm bass, melodic groove",
    "인디 팝": "Indie pop, bright guitar, catchy melody, youthful band sound",
    "로파이": "Lo-fi chillhop, dusty drums, mellow keys, cozy tape texture",
    "어쿠스틱 포크": "Acoustic folk, fingerpicked guitar, organic percussion, intimate warmth",
    "클래식": "Modern classical, expressive piano, chamber strings, elegant dynamics",
    "시네마틱": "Cinematic soundtrack, sweeping strings, emotional build, dramatic atmosphere",
}

LEGACY_MOOD_TO_STYLE: Final[dict[str, str]] = {
    "잔잔한": "발라드",
    "밝은": "인디 팝",
    "서정적": "클래식",
    "신나는": "힙합",
    "몽환적": "로파이",
    "따뜻한": "어쿠스틱 포크",
    "그리운": "재즈",
    "용감한": "시네마틱",
}

SUPPORTED_STYLES: Final[tuple[str, ...]] = tuple(STYLE_PROMPT_MAP.keys())


def extract_kie_error_message(response: httpx.Response) -> str | None:
    try:
        payload: object = response.json()
    except ValueError:
        text = response.text.strip()
        return text or None

    if not isinstance(payload, dict):
        return None
    payload_dict = cast(dict[str, object], payload)

    code = payload_dict.get("code")
    message = payload_dict.get("msg")
    status_text = f"Kie.ai status {response.status_code}"

    if isinstance(code, int):
        status_text = f"Kie.ai code {code}"

    if isinstance(message, str) and message.strip():
        return f"{status_text}: {message.strip()}"

    return status_text


LYRICS_CONVERSION_PROMPT: Final[str] = """당신은 노래 가사 작사가입니다.
아래 글을 한국어 노래 가사로 변환해 주세요.

## 규칙
- Suno AI 형식의 섹션 태그를 반드시 사용하세요: [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]
- 원래 글의 감정과 핵심 메시지를 살리세요
- 각 섹션은 2~4줄로 짧게 작성하세요
- 노래 전체 길이는 1~2분 분량으로 (총 12~20줄)
- 운율과 리듬감이 느껴지도록 작성하세요
- 이모지, 해시태그, 마크다운 서식은 사용하지 마세요
- 가사 텍스트만 출력하세요, 설명은 불필요합니다

## 주제: {topic}
## 스타일: {style}

## 원본 글:
{text}
"""


def normalize_music_style(style: str | None) -> str | None:
    if style is None:
        return None

    normalized = style.strip()
    if not normalized:
        return None
    if normalized in STYLE_PROMPT_MAP:
        return normalized
    return LEGACY_MOOD_TO_STYLE.get(normalized)


async def convert_text_to_lyrics(text: str, topic: str, style: str) -> str:
    """Convert user's written text into Suno-formatted lyrics using Gemini.

    Returns formatted lyrics with [Verse], [Chorus], etc. tags.
    Falls back to raw text if Gemini is unavailable.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning(
            "convert_text_to_lyrics: GEMINI_API_KEY is empty, using raw text"
        )
        return text

    prompt = LYRICS_CONVERSION_PROMPT.format(
        topic=topic or "오늘의 이야기",
        style=style,
        text=text[:2000],
    )

    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{settings.GEMINI_MODEL}:generateContent"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.8,
            "maxOutputTokens": 1024,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    try:
        timeout = httpx.Timeout(30.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                endpoint,
                params={"key": settings.GEMINI_API_KEY},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        candidates = data.get("candidates") if isinstance(data, dict) else None
        if not isinstance(candidates, list) or not candidates:
            logger.warning("convert_text_to_lyrics: no candidates in response")
            return text

        parts = (
            candidates[0].get("content", {}).get("parts", [])
            if isinstance(candidates[0], dict)
            else []
        )
        lyrics = "\n".join(
            p.get("text", "")
            for p in parts
            if isinstance(p, dict) and isinstance(p.get("text"), str)
        ).strip()

        if not lyrics:
            logger.warning("convert_text_to_lyrics: empty lyrics from Gemini")
            return text

        logger.info(
            "convert_text_to_lyrics: successfully generated %d chars of lyrics",
            len(lyrics),
        )
        return lyrics[:3000]

    except (httpx.HTTPError, Exception) as exc:
        logger.warning(
            "convert_text_to_lyrics: Gemini failed (%s), using raw text", exc
        )
        return text


async def build_music_prompt(
    topic: str,
    style: str,
    draft_text: str,
) -> tuple[str, str, bool]:
    """Build a Suno prompt from the photo's topic, style, and written text.

    If draft_text is provided, converts it to Suno-formatted lyrics via Gemini.
    Otherwise, generates an instrumental piece.

    Returns (prompt, style, instrumental) tuple.
    """
    style_label = normalize_music_style(style) or DEFAULT_STYLE
    style_prompt = STYLE_PROMPT_MAP[style_label]

    # If user wrote text, convert to lyrics via Gemini
    if draft_text.strip():
        lyrics = await convert_text_to_lyrics(draft_text.strip(), topic, style_label)
        return lyrics, style_prompt, False

    # No text → instrumental
    prompt_parts = []
    if topic.strip():
        prompt_parts.append(
            f"A short instrumental piece inspired by the theme '{topic}'."
        )
    else:
        prompt_parts.append("A short instrumental background music piece.")
    prompt_parts.append(
        f"Genre/style: {style_label}. Keep it under 2 minutes, suitable as background music for a photo story."
    )

    return " ".join(prompt_parts), style_prompt, True


def _make_title(topic: str, draft_text: str) -> str:
    """Create a music title from topic and draft text."""
    if topic.strip():
        return topic.strip()[:50]
    # draft_text의 첫 줄에서 제목 추출
    if draft_text.strip():
        first_line = draft_text.strip().split("\n")[0].strip()
        # 너무 길면 자르기
        if len(first_line) > 40:
            first_line = first_line[:37] + "..."
        return first_line or "나의 이야기"
    return "나의 이야기"


CALLBACK_URL: Final[str] = (
    "https://api.storylens.dmssolution.co.kr/api/v1/music/callback"
)


async def generate_music(
    topic: str,
    style: str,
    draft_text: str,
) -> dict[str, str]:
    """Start a music generation task via Kie.ai Suno API.

    Returns {"task_id": str} on success.
    Raises ValueError if API key is missing.
    Raises httpx.HTTPStatusError on API errors.
    """
    if not settings.KIE_API_KEY:
        raise ValueError("KIE_API_KEY is not configured")

    prompt, style_prompt, use_instrumental = await build_music_prompt(
        topic, style, draft_text
    )

    payload = {
        "prompt": prompt,
        "customMode": True,
        "instrumental": use_instrumental,
        "model": settings.KIE_SUNO_MODEL,
        "style": style_prompt,
        "title": _make_title(topic, draft_text),
        "callBackUrl": CALLBACK_URL,
    }

    headers = {
        "Authorization": f"Bearer {settings.KIE_API_KEY}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(GENERATE_ENDPOINT, json=payload, headers=headers)
        if response.is_error:
            provider_error = extract_kie_error_message(response)
            if provider_error:
                logger.warning(
                    "generate_music: request failed detail=%s", provider_error
                )
        _ = response.raise_for_status()
        data = response.json()

    if data.get("code") != 200:
        logger.error("Kie.ai generate error: %s", data.get("msg"))
        raise ValueError(data.get("msg", "Music generation failed"))

    task_id = data.get("data", {}).get("taskId")
    if not task_id:
        raise ValueError("No taskId in response")

    logger.info("Music generation started: taskId=%s", task_id)
    return {"task_id": task_id}


async def check_music_status(task_id: str) -> dict[str, object]:
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
        _ = response.raise_for_status()
        data = response.json()

    if data.get("code") != 200:
        return {"status": "error", "message": data.get("msg", "Unknown error")}

    task_data = data.get("data", {})
    status = task_data.get("status", "PENDING")

    result: dict[str, object] = {"status": status, "task_id": task_id}

    if status == "SUCCESS":
        suno_data = (
            task_data.get("response", {}).get("sunoData", [])
            if isinstance(task_data.get("response"), dict)
            else []
        )
        tracks = []
        for track in suno_data:
            if isinstance(track, dict) and track.get("audioUrl"):
                tracks.append(
                    {
                        "id": track.get("id", ""),
                        "audio_url": track["audioUrl"],
                        "stream_url": track.get("streamAudioUrl", ""),
                        "image_url": track.get("imageUrl", ""),
                        "title": track.get("title", ""),
                        "duration": track.get("duration", 0),
                        "tags": track.get("tags", ""),
                    }
                )
        result["tracks"] = tracks

    elif status in (
        "CREATE_TASK_FAILED",
        "GENERATE_AUDIO_FAILED",
        "SENSITIVE_WORD_ERROR",
    ):
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
