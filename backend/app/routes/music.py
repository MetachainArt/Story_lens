"""Music generation API routes."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..core.deps import CurrentUser
from ..services.music import (
    SUPPORTED_MOODS,
    check_music_status,
    generate_music,
)

router = APIRouter(prefix="/api/v1/music", tags=["music"])


class GenerateMusicRequest(BaseModel):
    topic: str = Field(default="", max_length=100)
    mood: str = Field(default="잔잔한", max_length=20)
    draft_text: str = Field(default="", max_length=2000)
    instrumental: bool = Field(default=True)  # ignored, determined by draft_text


class GenerateMusicResponse(BaseModel):
    task_id: str


class MusicStatusResponse(BaseModel):
    status: str
    task_id: str
    tracks: list[dict] = Field(default_factory=list)  # type: ignore[type-arg]
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


@router.get("/status/{task_id}", response_model=MusicStatusResponse)
async def get_status(
    task_id: str,
    _user: CurrentUser,
) -> MusicStatusResponse:
    """Check the status of a music generation task."""
    try:
        result = await check_music_status(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return MusicStatusResponse(
        status=result.get("status", "error"),
        task_id=result.get("task_id", task_id),
        tracks=result.get("tracks", []),
        message=result.get("message", ""),
    )
