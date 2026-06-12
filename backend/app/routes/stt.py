"""Speech-to-Text endpoint using OpenAI transcription models."""

import logging
from io import BytesIO

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File

from ..core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["stt"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """Transcribe audio using OpenAI speech-to-text."""
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
        logger.error("OpenAI STT API error: %s", e.response.text)
        raise HTTPException(status_code=502, detail="STT transcription failed")
    except Exception as e:
        logger.error("STT error: %s", e)
        raise HTTPException(status_code=500, detail="STT service error")
