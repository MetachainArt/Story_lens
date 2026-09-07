"""Music generation API routes."""

import logging
from pathlib import Path
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import AliasChoices, BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.deps import CurrentUser
from ..core.rate_limit import rate_limit
from ..db.session import get_db
from ..models.photo import Photo
from ..models.music_generation import MusicGenerationJob
from ..services.media_cleanup import remove_music_file
from ..services.music import (
    SUPPORTED_STYLES,
    check_music_status,
    download_music_file,
    extract_kie_error_message,
    generate_music,
    normalize_music_style,
)

logger = logging.getLogger(__name__)
APP_ROOT = Path(__file__).resolve().parents[2]

router = APIRouter(prefix="/music", tags=["music"])


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
    lyric: str = ""


class MusicStatusResponse(BaseModel):
    status: str
    task_id: str
    tracks: list[TrackResponse] = Field(default_factory=list)
    message: str = ""


async def _require_owned_photo(
    db: AsyncSession,
    user_id: UUID,
    photo_id: str,
    *,
    lock: bool = False,
) -> UUID:
    try:
        parsed_photo_id = UUID(photo_id)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )

    query = select(Photo.id).where(
        Photo.id == parsed_photo_id,
        Photo.user_id == user_id,
    )
    if lock:
        query = query.with_for_update()
    result = await db.execute(query)
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )
    return parsed_photo_id


@router.get("/styles")
@router.get("/moods")
async def list_styles(_user: CurrentUser) -> dict[str, list[str]]:
    """List available music style options for generation."""
    return {"styles": list(SUPPORTED_STYLES), "moods": list(SUPPORTED_STYLES)}


@router.post(
    "/generate",
    response_model=GenerateMusicResponse,
    dependencies=[Depends(rate_limit(10, 60))],
)
async def start_generation(
    body: GenerateMusicRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> GenerateMusicResponse:
    """Start AI music generation via Kie.ai/Suno."""
    owned_photo_id = await _require_owned_photo(db, current_user.id, body.photo_id, lock=True)
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
    except httpx.HTTPStatusError as exc:
        provider_error = extract_kie_error_message(exc.response)
        if provider_error:
            logger.warning("Kie.ai generate request failed detail=%s", provider_error)
            raise HTTPException(status_code=502, detail=provider_error) from exc
        raise HTTPException(
            status_code=502, detail="Kie.ai generate request failed"
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    task_id = result.get("task_id")
    if not isinstance(task_id, str) or not task_id or len(task_id) > 255:
        raise HTTPException(status_code=502, detail="Music provider returned an invalid task")
    db.add(MusicGenerationJob(task_id=task_id, user_id=current_user.id, photo_id=owned_photo_id))
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Failed to save music task authorization")
        raise HTTPException(status_code=500, detail="음악 작업을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.")
    return GenerateMusicResponse(task_id=task_id)


@router.get("/status/{task_id}")
async def get_status(
    task_id: str,
    photo_id: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> MusicStatusResponse:
    """Check the status of a music generation task.

    If photo_id is provided and status is SUCCESS, the audio files
    will be automatically downloaded to the server.
    """
    owned_photo_id = await _require_owned_photo(db, current_user.id, photo_id, lock=True)
    job_result = await db.execute(
        select(MusicGenerationJob).where(
            MusicGenerationJob.task_id == task_id,
            MusicGenerationJob.user_id == current_user.id,
            MusicGenerationJob.photo_id == owned_photo_id,
        ).with_for_update()
    )
    job = job_result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Music task not found")
    saved_tracks: dict[str, TrackResponse] = {}
    if job.result_payload is not None:
        cached = MusicStatusResponse.model_validate(job.result_payload)
        if all(track.local_url for track in cached.tracks):
            return cached
        saved_tracks = {track.audio_url: track for track in cached.tracks if track.local_url}

    try:
        result = await check_music_status(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    tracks: list[TrackResponse] = []
    downloaded_urls: list[str] = []

    try:
        tracks_data = result.get("tracks")
        if result.get("status") == "SUCCESS" and isinstance(tracks_data, list):
            for track_data in tracks_data:
                if not isinstance(track_data, dict):
                    continue
                audio_url = track_data.get("audio_url", "")
                saved_track = saved_tracks.get(audio_url)
                local_url = saved_track.local_url if saved_track else ""

                # Download to our server if photo_id is provided
                if audio_url and not local_url:
                    try:
                        local_url = await download_music_file(
                            audio_url,
                            str(owned_photo_id),
                        )
                        downloaded_urls.append(local_url)
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
                        lyric=track_data.get("lyric", "") or "",
                    )
                )

        status_value = result.get("status")
        task_id_value = result.get("task_id")
        message_value = result.get("message")

        response = MusicStatusResponse(
            status=status_value if isinstance(status_value, str) else "error",
            task_id=task_id_value if isinstance(task_id_value, str) else task_id,
            tracks=tracks,
            message=message_value if isinstance(message_value, str) else "",
        )
        if response.status == "SUCCESS" and response.tracks:
            job.result_payload = response.model_dump()
            await db.commit()
        return response
    except Exception:
        await db.rollback()
        for url in downloaded_urls:
            remove_music_file(APP_ROOT, url, owned_photo_id)
        raise


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
