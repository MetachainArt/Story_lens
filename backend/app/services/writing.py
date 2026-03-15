import base64
import logging
from pathlib import Path
from typing import Final, cast

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


def extract_provider_error_message(response: httpx.Response) -> str | None:
    try:
        payload: object = response.json()
    except ValueError:
        text = response.text.strip()
        return text or None

    if not isinstance(payload, dict):
        return None
    payload_dict = cast(dict[str, object], payload)

    error_payload = payload_dict.get("error")
    if not isinstance(error_payload, dict):
        return None
    error_payload_dict = cast(dict[str, object], error_payload)

    message = error_payload_dict.get("message")
    status = error_payload_dict.get("status")

    parts: list[str] = []
    if isinstance(status, str) and status.strip():
        parts.append(status.strip())
    if isinstance(message, str) and message.strip():
        parts.append(message.strip())

    return ": ".join(parts) if parts else None


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


_TONE_GUIDES: Final[dict[str, str]] = {
    "에세이": "관찰자의 시선으로, 차분한 독백체. 보이는 것에서 생각으로 자연스럽게 흘러가는 문장.",
    "동화": "따뜻하고 다정한 말투. 사물이나 자연에 생명을 불어넣는 상상력. '~했어요' 체.",
    "소설": "장면을 묘사하듯 구체적으로. 인물의 시선과 내면을 담아 현장감 있게.",
    "시": "감각적 이미지와 은유. 짧은 행, 여백의 힘. 설명하지 말고 보여주기.",
    "일기": "오늘 하루의 솔직한 감정 기록. 꾸미지 않은 날것의 언어. '~했다' 체.",
    "편지": "누군가에게 말을 건네는 어조. '너에게' 또는 '당신에게' 시작. 진심이 담긴 문장.",
    "여행기": "장소의 풍경과 오감을 살려서. 발견의 기쁨과 이동의 설렘을 담아.",
    "인터뷰": "사진 속 대상에게 질문을 던지고 상상의 답을 받는 형식. Q와 A를 번갈아.",
}


def _build_prompt(topic: str, tone: str, keywords: list[str], current_text: str) -> str:
    keyword_text = ", ".join(keywords) if keywords else "없음"
    tone_guide = _TONE_GUIDES.get(tone, _TONE_GUIDES["에세이"])
    seed_section = (
        f'\n사용자가 이미 쓴 문장이 있습니다. 이 흐름을 자연스럽게 이어가세요:\n"{current_text.strip()}"'
        if current_text.strip()
        else ""
    )

    return (
        "당신은 사진을 보고 짧은 글을 쓰는 따뜻한 글쓰기 코치입니다.\n"
        "사진을 천천히 관찰한 뒤, 아래 구조로 최대 5줄의 글을 작성하세요.\n"
        "\n"
        "## 글의 흐름\n"
        "1줄: 관찰 — 사진에서 눈에 띄는 장면이나 디테일을 한 문장으로\n"
        "2줄: 감각 — 그 장면에서 느껴지는 소리, 냄새, 온도, 촉감\n"
        "3줄: 감정 — 사진을 보며 떠오르는 감정이나 기억\n"
        "4줄: 성찰 — 주제와 연결된 생각이나 깨달음\n"
        "5줄: 여운 — 읽는 사람의 마음에 남는 마무리 한 줄\n"
        "\n"
        f"## 톤: {tone}\n"
        f"{tone_guide}\n"
        "\n"
        f"## 주제: {topic}\n"
        f"## 키워드: {keyword_text}\n"
        "키워드는 억지로 넣지 말고, 글의 흐름에 자연스럽게 녹여주세요.\n"
        "\n"
        "## 규칙\n"
        "- 한 줄에 한 문장, 자연스러운 길이로 쓸 것\n"
        "- 이모지, 해시태그, 마크다운 서식 금지\n"
        '- 상투적 표현("아름다운 하루", "소중한 순간", "행복한 시간") 사용 금지\n'
        "- 완결하지 말 것 — 작가가 이어쓸 여지를 남기세요\n"
        "- 결과는 5줄 이내의 순수 텍스트만 출력\n"
        f"{seed_section}"
    )


def _read_image_file(photo: Photo) -> tuple[str, str] | None:
    image_url = (photo.edited_url or photo.original_url or "").strip()
    if not image_url:
        logger.warning("_read_image_file: no image URL on photo %s", photo.id)
        return None

    if image_url.startswith("data:image/"):
        try:
            header, encoded = image_url.split(",", 1)
        except ValueError:
            logger.warning("_read_image_file: malformed data URL")
            return None
        mime_type = header[5:].split(";", 1)[0].strip().lower()
        return mime_type, encoded

    allowed_prefix = f"/uploads/photos/{photo.user_id}/"
    if not image_url.startswith(allowed_prefix):
        logger.warning(
            "_read_image_file: URL %r doesn't start with %s", image_url, allowed_prefix
        )
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
        _ = absolute_path.relative_to(uploads_root)
    except ValueError:
        logger.warning("_read_image_file: path traversal check failed")
        return None

    if not absolute_path.exists() or not absolute_path.is_file():
        logger.warning(
            "_read_image_file: file not found at %s (BACKEND_ROOT=%s)",
            absolute_path,
            _BACKEND_ROOT,
        )
        return None
    if absolute_path.stat().st_size > MAX_INLINE_IMAGE_BYTES:
        logger.warning(
            "_read_image_file: file too large (%d bytes)", absolute_path.stat().st_size
        )
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
        logger.warning("generate_draft: GEMINI_API_KEY is empty, using fallback")
        return build_fallback_draft(topic, tone, keywords, current_text), "fallback"

    logger.info(
        "generate_draft: photo_id=%s, original_url=%s, edited_url=%s, model=%s",
        photo.id,
        photo.original_url,
        photo.edited_url,
        settings.GEMINI_MODEL,
    )
    image_payload = _read_image_file(photo)
    if not image_payload:
        logger.warning("generate_draft: _read_image_file returned None, using fallback")
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
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    timeout = httpx.Timeout(float(settings.GEMINI_TIMEOUT_SECONDS), connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            endpoint,
            params={"key": settings.GEMINI_API_KEY},
            json=payload,
        )
        if response.is_error:
            provider_error = extract_provider_error_message(response)
            if provider_error:
                logger.warning(
                    "generate_draft: Gemini request failed with status=%s detail=%s",
                    response.status_code,
                    provider_error,
                )
        _ = response.raise_for_status()
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


async def chat_write_with_gemini(
    photo: Photo,
    topic: str,
    message: str,
    history: list[dict],
    exchange_count: int,
    compile_story: bool = False,
) -> str:
    """Chat-based writing assistant using Gemini multi-turn conversation."""
    if not settings.GEMINI_API_KEY:
        if compile_story:
            return "지금까지 나눈 이야기를 바탕으로 예쁜 글이 완성됐어! 잘 썼어 😊"
        if exchange_count >= 5:
            return "이야기가 많이 쌓였어! 더 쓸 거야? 아니면 여기서 끝낼까? 😊"
        return "좋아! 그 순간 어떤 기분이 들었어? 😊"

    image_payload = _read_image_file(photo)
    mime_type, encoded_image = image_payload if image_payload else (None, None)

    system_instruction = """너는 초등학생 아이들의 사진 이야기를 함께 만드는 다정한 친구야.

규칙:
- 항상 반말로, 친구처럼 대화해. 이모지를 가끔 써서 친근하게.
- 아이의 말에 짧게 공감해 (1문장)
- 이야기를 발전시킬 수 있는 질문을 딱 하나만 해 (쉽고 구체적으로: 색깔, 소리, 느낌 등)
- 답변은 짧게 (2-3문장 이내)
- exchange_count가 5 이상이면 반드시 "이야기가 많이 쌓였어! 더 쓸 거야? 아니면 여기서 끝낼까? 😊" 라고 물어봐"""

    compile_instruction = """지금까지의 대화를 바탕으로 아이의 사진 이야기를 완성된 글로 만들어줘.
- 대화에서 나온 내용만 사용해서 5줄 이내의 따뜻한 이야기로 만들어
- 아이의 목소리(1인칭)로 자연스럽게 써줘
- 완성된 글만 출력해. 설명이나 인사말 없이."""

    # Build contents for multi-turn
    contents = []
    for turn in history:
        role = "model" if turn.get("role") == "ai" else "user"
        contents.append({"role": role, "parts": [{"text": turn.get("text", "")}]})

    if compile_story:
        contents.append({"role": "user", "parts": [{"text": compile_instruction}]})
    else:
        user_parts: list[dict] = [{"text": message}]
        if exchange_count >= 5:
            user_parts[0]["text"] += f"\n\n[참고: 대화 횟수={exchange_count}회, 이제 끝낼지 물어봐]"
        contents.append({"role": "user", "parts": user_parts})

    payload: dict = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.8,
            "maxOutputTokens": 512,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    # Attach photo image to first user turn if available
    if mime_type and encoded_image and contents:
        first_user_idx = next(
            (i for i, c in enumerate(contents) if c.get("role") == "user"), None
        )
        if first_user_idx is not None:
            contents[first_user_idx]["parts"].append(
                {"inline_data": {"mime_type": mime_type, "data": encoded_image}}
            )

    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/"
        f"models/{settings.GEMINI_MODEL}:generateContent"
    )
    timeout = httpx.Timeout(float(settings.GEMINI_TIMEOUT_SECONDS), connect=5.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            endpoint,
            params={"key": settings.GEMINI_API_KEY},
            json=payload,
        )
        if response.is_error:
            logger.warning("chat_write: Gemini error %s", response.status_code)
            if compile_story:
                return "글 완성에 실패했어. 다시 눌러봐! 😅"
            return "잠깐 생각 중이야... 다시 말해줄래? 😊"

    data = response.json()
    candidates = data.get("candidates", [])
    if not candidates:
        return "잠깐 생각 중이야... 다시 말해줄래? 😊"

    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts).strip()
    return text or "좋아! 계속 얘기해줘 😊"
