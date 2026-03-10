"""Music generation API routes."""

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..core.deps import CurrentUser
from ..services.music import (
    SUPPORTED_MOODS,
    check_music_status,
    download_music_file,
    generate_music,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/music", tags=["music"])


class GenerateMusicRequest(BaseModel):
    topic: str = Field(default="", max_length=100)
    mood: str = Field(default="잔잔한", max_length=20)
    draft_text: str = Field(default="", max_length=2000)
    photo_id: str = Field(default="", max_length=100)
    instrumental: bool = Field(default=True)  # ignored, determined by draft_text


class GenerateMusicResponse(BaseModel):
    task_id: str


class TrackResponse(BaseModel):
    id: str = ""
    audio_url: str = ""
    stream_url: str = ""
    image_url: str = ""
    title: str = ""
    duration: float = 0
    tags: str = ""
    local_url: str = ""


class MusicStatusResponse(BaseModel):
    status: str
    task_id: str
    tracks: list[TrackResponse] = Field(default_factory=list)
    message: str = ""


@router.get("/moods")
async def list_moods(_user: CurrentUser) -> dict:
    """List available mood options for music generation."""
    return {"moods": list(SUPPORTED_MOODS)}


@router.post("/generate", response_model=GenerateMusicResponse)
async def start_generation(
    body: GenerateMusicRequest,
    _user: CurrentUser,
) -> GenerateMusicResponse:
    """Start AI music generation via Kie.ai/Suno."""
    if body.mood not in SUPPORTED_MOODS:
        raise HTTPException(status_code=422, detail=f"지원하지 않는 분위기: {body.mood}")

    try:
        result = await generate_music(
            topic=body.topic,
            mood=body.mood,
            draft_text=body.draft_text,
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return GenerateMusicResponse(task_id=result["task_id"])


@router.get("/status/{task_id}")
async def get_status(
    task_id: str,
    _user: CurrentUser,
    photo_id: str = "",
) -> MusicStatusResponse:
    """Check the status of a music generation task.

    If photo_id is provided and status is SUCCESS, the audio files
    will be automatically downloaded to the server.
    """
    try:
        result = await check_music_status(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    tracks: list[TrackResponse] = []

    if result.get("status") == "SUCCESS" and result.get("tracks"):
        for track_data in result["tracks"]:
            audio_url = track_data.get("audio_url", "")
            local_url = ""

            # Download to our server if photo_id is provided
            if audio_url and photo_id:
                try:
                    local_url = await download_music_file(audio_url, photo_id)
                except ValueError:
                    logger.warning("Failed to download track, using original URL")

            tracks.append(TrackResponse(
                id=track_data.get("id", ""),
                audio_url=audio_url,
                stream_url=track_data.get("stream_url", ""),
                image_url=track_data.get("image_url", ""),
                title=track_data.get("title", ""),
                duration=track_data.get("duration", 0),
                tags=track_data.get("tags", ""),
                local_url=local_url,
            ))

    return MusicStatusResponse(
        status=result.get("status", "error"),
        task_id=result.get("task_id", task_id),
        tracks=tracks,
        message=result.get("message", ""),
    )


@router.post("/callback")
async def music_callback(request: Request) -> dict:
    """Callback endpoint for Kie.ai to notify when music generation is complete.

    This endpoint receives the generation result from Kie.ai.
    The actual download happens when the frontend polls for status.
    """
    try:
        body = await request.json()
        logger.info("Music callback received: %s", body.get("data", {}).get("taskId", "unknown"))
    except Exception:
        logger.warning("Failed to parse music callback body")

    return {"received": True}
