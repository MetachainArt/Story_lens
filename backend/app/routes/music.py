"""Music generation API routes."""

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import AliasChoices, BaseModel, Field

from ..core.deps import CurrentUser
from ..services.music import (
    SUPPORTED_STYLES,
    check_music_status,
    download_music_file,
    generate_music,
    normalize_music_style,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/music", tags=["music"])


class GenerateMusicRequest(BaseModel):
    topic: str = Field(default="", max_length=100)
    style: str = Field(
        default="발라드",
        validation_alias=AliasChoices("style", "mood"),
        max_length=20,
    )
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


@router.get("/styles")
@router.get("/moods")
async def list_styles(_user: CurrentUser) -> dict[str, list[str]]:
    """List available music style options for generation."""
    return {"styles": list(SUPPORTED_STYLES), "moods": list(SUPPORTED_STYLES)}


@router.post("/generate", response_model=GenerateMusicResponse)
async def start_generation(
    body: GenerateMusicRequest,
    _user: CurrentUser,
) -> GenerateMusicResponse:
    """Start AI music generation via Kie.ai/Suno."""
    normalized_style = normalize_music_style(body.style)
    if normalized_style is None:
        raise HTTPException(
            status_code=422, detail=f"지원하지 않는 음악 스타일: {body.style}"
        )

    try:
        result = await generate_music(
            topic=body.topic,
            style=normalized_style,
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

    tracks_data = result.get("tracks")
    if result.get("status") == "SUCCESS" and isinstance(tracks_data, list):
        for track_data in tracks_data:
            if not isinstance(track_data, dict):
                continue
            audio_url = track_data.get("audio_url", "")
            local_url = ""

            # Download to our server if photo_id is provided
            if audio_url and photo_id:
                try:
                    local_url = await download_music_file(audio_url, photo_id)
                except ValueError:
                    logger.warning("Failed to download track, using original URL")

            tracks.append(
                TrackResponse(
                    id=track_data.get("id", ""),
                    audio_url=audio_url,
                    stream_url=track_data.get("stream_url", ""),
                    image_url=track_data.get("image_url", ""),
                    title=track_data.get("title", ""),
                    duration=track_data.get("duration", 0),
                    tags=track_data.get("tags", ""),
                    local_url=local_url,
                )
            )

    status_value = result.get("status")
    task_id_value = result.get("task_id")
    message_value = result.get("message")

    return MusicStatusResponse(
        status=status_value if isinstance(status_value, str) else "error",
        task_id=task_id_value if isinstance(task_id_value, str) else task_id,
        tracks=tracks,
        message=message_value if isinstance(message_value, str) else "",
    )


@router.post("/callback")
async def music_callback(request: Request) -> dict[str, bool]:
    """Callback endpoint for Kie.ai to notify when music generation is complete.

    This endpoint receives the generation result from Kie.ai.
    The actual download happens when the frontend polls for status.
    """
    try:
        body = await request.json()
        logger.info(
            "Music callback received: %s", body.get("data", {}).get("taskId", "unknown")
        )
    except Exception:
        logger.warning("Failed to parse music callback body")

    return {"received": True}
