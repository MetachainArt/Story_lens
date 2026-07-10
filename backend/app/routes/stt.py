"""Speech-to-Text endpoint using OpenAI transcription models."""

import logging
from io import BytesIO
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from ..core.config import settings
from ..core.deps import CurrentUser
from ..core.rate_limit import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(tags=["stt"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

STTRateLimit = Annotated[
    None,
    Depends(
        rate_limit(
            settings.STT_MAX_REQUESTS_PER_MINUTE,
            60,
            scope="stt",
        )
    ),
]


@router.post("/stt")
async def speech_to_text(
    _user: CurrentUser,
    _rate_limited: STTRateLimit,
    file: UploadFile = File(...),
):
    """Transcribe audio using OpenAI speech-to-text. Requires authentication."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="STT service not configured")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Audio file too large (max 10MB)")
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="Audio file too small")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                files={"file": (file.filename or "recording.mp4", BytesIO(content), file.content_type or "audio/mp4")},
                data={
                    "model": settings.OPENAI_STT_MODEL,
                    "language": "ko",
                    "prompt": (
                        "Korean dictation for a photo story writing app. "
                        "The speaker may be a child or beginner. "
                        "Ignore background noise and filler sounds. "
                        "Return only the spoken meaning as a natural Korean sentence. "
                        "Do not repeat words unless the speaker clearly repeats them intentionally."
                    ),
                },
            )
            resp.raise_for_status()
            result = resp.json()
            return {"text": result.get("text", "")}
    except httpx.HTTPStatusError as e:
        logger.error("OpenAI STT API returned status %s", e.response.status_code)
        raise HTTPException(
            status_code=502,
            detail="음성을 글로 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.",
        )
    except Exception as e:
        logger.exception("Unexpected STT error: %s", type(e).__name__)
        raise HTTPException(
            status_code=500,
            detail="음성 입력을 처리하지 못했어요. 다시 시도해 주세요.",
        )
