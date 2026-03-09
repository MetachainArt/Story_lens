import base64
import logging
from pathlib import Path
from typing import Final

import httpx

from ..core.config import settings
from ..models.photo import Photo

logger = logging.getLogger(__name__)

_BACKEND_ROOT: Final[Path] = Path(__file__).resolve().parent.parent.parent

SUPPORTED_TONES: Final[tuple[str, ...]] = (
    "에세이",
    "동화",
    "소설",
    "시",
    "일기",
    "편지",
    "여행기",
    "인터뷰",
)
MAX_INLINE_IMAGE_BYTES: Final[int] = 20 * 1024 * 1024


def normalize_keywords(raw_keywords: list[str]) -> list[str]:
    normalized: list[str] = []
    for keyword in raw_keywords:
        item = keyword.strip()
        if not item:
            continue
        if len(item) > 30:
            item = item[:30]
        if item not in normalized:
            normalized.append(item)
    return normalized[:10]


def clamp_text_lines(text: str, max_lines: int = 5) -> str:
    lines = [
        line.strip() for line in text.replace("\r\n", "\n").split("\n") if line.strip()
    ]
    if not lines:
        return ""
    return "\n".join(lines[:max_lines])


def _build_prompt(topic: str, tone: str, keywords: list[str], current_text: str) -> str:
    keyword_text = ", ".join(keywords) if keywords else "없음"
    return (
        "당신은 초등 고학년~성인이 읽기 좋은 한국어 글쓰기 코치입니다.\n"
        f"주제: {topic}\n"
        f"톤: {tone}\n"
        f"핵심 키워드: {keyword_text}\n"
        "요청:\n"
        "1) 사진 분위기와 주제를 반영해 자연스러운 한국어 문장을 작성\n"
        "2) 결과는 반드시 최대 5줄\n"
        "3) 각 줄은 28자 이하의 짧은 문장\n"
        "4) 과장된 이모지/해시태그/마크다운 금지\n"
        "5) 마지막 줄은 감정이 남는 마무리\n"
        f"현재 사용자가 작성한 문장(참고): {current_text.strip() if current_text.strip() else '없음'}"
    )


def _read_image_file(photo: Photo) -> tuple[str, str] | None:
    image_url = (photo.edited_url or photo.original_url or "").strip()
    if not image_url:
        return None

    if image_url.startswith("data:image/"):
        try:
            header, encoded = image_url.split(",", 1)
        except ValueError:
            return None
        mime_type = header[5:].split(";", 1)[0].strip().lower()
        return mime_type, encoded

    allowed_prefix = f"/uploads/photos/{photo.user_id}/"
    if not image_url.startswith(allowed_prefix):
        return None

    ext = Path(image_url).suffix.lower()
    mime_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")

    uploads_root = (_BACKEND_ROOT / "uploads").resolve()
    absolute_path = (_BACKEND_ROOT / image_url.lstrip("/")).resolve()
    try:
        absolute_path.relative_to(uploads_root)
    except ValueError:
        logger.warning("_read_image_file: path traversal check failed")
        return None

    if not absolute_path.exists() or not absolute_path.is_file():
        logger.warning("_read_image_file: file not found at %s", absolute_path)
        return None
    if absolute_path.stat().st_size > MAX_INLINE_IMAGE_BYTES:
        return None

    encoded = base64.b64encode(absolute_path.read_bytes()).decode("utf-8")
    return mime_type, encoded


def build_fallback_draft(
    topic: str, tone: str, keywords: list[str], current_text: str
) -> str:
    keyword_text = ", ".join(keywords[:2]) if keywords else "작은 장면"
    seed = current_text.strip()
    lines = [
        f"{topic}을 떠올리며 숨을 고르고 시작해요.",
        f"{keyword_text}이(가) 스치듯 기억을 깨워요.",
        f"{tone} 톤으로 오늘의 장면을 천천히 풀어내요.",
    ]
    if seed:
        lines.append(f"'{seed[:24]}'의 마음을 이어 써볼게요.")
    lines.append("끝에는 따뜻한 여운 한 줄을 남겨요.")
    return clamp_text_lines("\n".join(lines), max_lines=5)


async def generate_draft_with_gemini(
    photo: Photo,
    topic: str,
    tone: str,
    keywords: list[str],
    current_text: str,
) -> tuple[str, str]:
    if not settings.GEMINI_API_KEY:
        return build_fallback_draft(topic, tone, keywords, current_text), "fallback"

    image_payload = _read_image_file(photo)
    if not image_payload:
        return build_fallback_draft(topic, tone, keywords, current_text), "fallback"

    mime_type, encoded_image = image_payload
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{settings.GEMINI_MODEL}:generateContent"
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": _build_prompt(
                            topic=topic,
                            tone=tone,
                            keywords=keywords,
                            current_text=current_text,
                        )
                    },
                    {"inline_data": {"mime_type": mime_type, "data": encoded_image}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048,
        },
    }

    timeout = httpx.Timeout(float(settings.GEMINI_TIMEOUT_SECONDS), connect=5.0)
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
        return build_fallback_draft(topic, tone, keywords, current_text), "fallback"

    parts = (
        candidates[0].get("content", {}).get("parts", [])
        if isinstance(candidates[0], dict)
        else []
    )
    text_chunks = [
        p.get("text", "")
        for p in parts
        if isinstance(p, dict) and isinstance(p.get("text"), str)
    ]
    generated = clamp_text_lines("\n".join(text_chunks), max_lines=5)
    if not generated:
        return build_fallback_draft(topic, tone, keywords, current_text), "fallback"
    return generated, "gemini"
