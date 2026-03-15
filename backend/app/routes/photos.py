# @TASK P2-R2-T1 - Photos API 라우트
# @SPEC docs/planning/05-api-design.md#photos-api
"""Photos API endpoints."""

import base64
import binascii
import logging
import os
from pathlib import Path
from typing import List, Optional
from uuid import UUID, uuid4

import anyio
import httpx
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    status,
    Query,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete as sa_delete, select

from ..db.session import get_db
from ..core.deps import CurrentUser
from ..models.edit_history import EditHistory
from ..models.photo import Photo
from ..models.session import Session
from ..models.user import User
from ..schemas.photo import (
    DraftGenerationRequest,
    DraftGenerationResponse,
    PhotoResponse,
    PhotoUpdate,
    SentenceRecommendationRequest,
    SentenceRecommendationResponse,
)
from pydantic import BaseModel, Field

from ..services.writing import (
    SUPPORTED_TONES,
    build_fallback_draft,
    chat_write_with_gemini,
    clamp_text_lines,
    extract_provider_error_message,
    generate_draft_with_gemini,
    normalize_keywords,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/photos", tags=["photos"])

UPLOAD_DIR = str((Path(__file__).resolve().parents[2] / "uploads" / "photos").resolve())
MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
DATA_URL_MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}


def _normalize_recommendation_keywords(raw_keywords: list[str]) -> list[str]:
    normalized: list[str] = []
    for keyword in raw_keywords:
        item = keyword.strip()
        if not item:
            continue
        if len(item) > 30:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each keyword must be at most 30 characters",
            )
        if item not in normalized:
            normalized.append(item)

    if len(normalized) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A recommendation request can include up to 10 keywords",
        )
    return normalized


def _build_recommendation_sentences(topic: str, keywords: list[str]) -> list[str]:
    hint = topic.strip() if topic.strip() else "오늘의 순간"
    keyword_text = ", ".join(keywords[:3]) if keywords else "표정과 소리"
    return [
        f"{hint}을(를) 보며 {keyword_text}이(가) 떠오른 순간부터 이야기를 시작해볼까요?",
        f"{hint} 장면에서 가장 기억에 남는 감정을 한 문장으로 먼저 적어보세요.",
        f"{hint} 사진 속 인물의 행동과 분위기를 이어서 적으면 더 생생한 문장이 돼요.",
    ]


def _safe_resolve_path(base_dir: str | Path, url_path: str) -> str | None:
    """Resolve a URL path to a safe filesystem path under base_dir.
    Returns None if the path escapes the base directory."""
    base_path = Path(base_dir).resolve()
    cleaned_parts = Path(url_path.lstrip("/")).parts
    if not cleaned_parts or cleaned_parts[0] != "uploads":
        return None
    resolved_path = (base_path / Path(*cleaned_parts[1:])).resolve()
    try:
        _ = resolved_path.relative_to(base_path)
    except ValueError:
        return None
    return str(resolved_path)


def _save_data_url_image(data_url: str, user_id: UUID) -> str:
    try:
        header, encoded = data_url.split(",", 1)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid edited_url",
        )

    if not header.startswith("data:") or ";base64" not in header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid edited_url",
        )

    mime_type = header[5:].split(";", 1)[0].strip().lower()
    file_ext = DATA_URL_MIME_TO_EXT.get(mime_type)
    if not file_ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid edited_url",
        )

    try:
        decoded_bytes = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid edited_url",
        )

    if not decoded_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid edited_url",
        )

    if len(decoded_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
        )

    user_dir = os.path.join(UPLOAD_DIR, str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    filename = f"{uuid4()}{file_ext}"
    file_path = os.path.join(user_dir, filename)

    try:
        with open(file_path, "wb") as edited_file:
            edited_file.write(decoded_bytes)
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file",
        )

    return f"/uploads/photos/{user_id}/{filename}"


@router.post("", response_model=PhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    topic: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload a new photo."""
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image"
        )

    # Validate file extension
    file_ext = os.path.splitext(file.filename or "image.jpg")[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Validate session_id if provided (lenient: bad/missing session just skipped)
    session_uuid = None
    if session_id:
        try:
            candidate = UUID(session_id)
            result = await db.execute(
                select(Session).where(
                    Session.id == candidate, Session.user_id == current_user.id
                )
            )
            session_obj = result.scalar_one_or_none()
            if session_obj:
                session_uuid = candidate
            else:
                logger.warning("session_id %s not found for user %s, uploading without session", session_id, current_user.id)
        except ValueError:
            logger.warning("Invalid session_id format: %s, uploading without session", session_id)

    # Create user directory if it doesn't exist
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)

    # Generate unique filename
    filename = f"{uuid4()}{file_ext}"
    file_path = os.path.join(user_dir, filename)

    # Save file as stream to avoid loading entire body in memory
    try:
        written_size = 0
        chunk_size = 1024 * 1024
        await file.seek(0)
        async with await anyio.open_file(file_path, "wb") as out_file:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                written_size += len(chunk)
                if written_size > MAX_UPLOAD_SIZE:
                    await out_file.aclose()
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
                    )
                await out_file.write(chunk)
    except HTTPException:
        raise
    except OSError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file",
        )

    # Create photo record
    original_url = f"/uploads/photos/{current_user.id}/{filename}"
    photo = Photo(
        user_id=current_user.id,
        session_id=session_uuid,
        original_url=original_url,
        title=title,
        topic=topic.strip() if topic and topic.strip() else None,
    )

    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    return photo


@router.get("", response_model=List[PhotoResponse])
async def get_photos(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    student_id: str | None = Query(default=None),
):
    """Get list of user's photos. Teachers can view student photos via student_id."""
    limit = min(limit, 100)

    target_user_id = current_user.id
    if student_id and current_user.role == "teacher":
        # Any teacher can view any student's photos
        student = await db.execute(
            select(User).where(
                User.id == student_id,
                User.role == "student",
            )
        )
        if student.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Student not found",
            )
        target_user_id = student_id

    query = select(Photo).where(Photo.user_id == target_user_id)

    if month is not None and year is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="year is required when month is provided",
        )

    if year is not None and month is None:
        from datetime import date as dt_date

        year_start = dt_date(year, 1, 1)
        next_year_start = dt_date(year + 1, 1, 1)
        query = query.where(
            Photo.updated_at >= year_start, Photo.updated_at < next_year_start
        )

    if year is not None and month is not None:
        from datetime import date as dt_date

        month_start = dt_date(year, month, 1)
        if month == 12:
            next_month_start = dt_date(year + 1, 1, 1)
        else:
            next_month_start = dt_date(year, month + 1, 1)
        query = query.where(
            Photo.updated_at >= month_start, Photo.updated_at < next_month_start
        )

    result = await db.execute(
        query.order_by(Photo.updated_at.desc()).offset(skip).limit(limit)
    )
    photos = result.scalars().all()
    return photos


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Get a single photo by ID. Teachers can view any student's photo."""
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    # Allow access if: photo owner, or teacher viewing a student's photo
    if photo.user_id != current_user.id:
        if current_user.role != "teacher":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Photo not found"
            )
        # Teacher: verify the photo owner is a student (not another teacher)
        owner_result = await db.execute(
            select(User).where(User.id == photo.user_id, User.role == "student")
        )
        if owner_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Photo not found"
            )

    return photo


@router.put("/{photo_id}", response_model=PhotoResponse)
async def update_photo(
    photo_id: UUID,
    photo_update: PhotoUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Update a photo (for saving edits)."""
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.user_id == current_user.id,
        )
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    # Update fields
    if photo_update.title is not None:
        photo.title = photo_update.title
    if photo_update.topic is not None:
        trimmed = photo_update.topic.strip()
        photo.topic = trimmed if trimmed else None
    if photo_update.edited_url is not None:
        if photo_update.edited_url.startswith("/uploads/photos/"):
            user_prefix = f"/uploads/photos/{current_user.id}/"
            if not photo_update.edited_url.startswith(user_prefix):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid edited_url",
                )
            photo.edited_url = photo_update.edited_url
        elif photo_update.edited_url.startswith("data:image/"):
            photo.edited_url = _save_data_url_image(
                photo_update.edited_url, current_user.id
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid edited_url"
            )
    if photo_update.content is not None:
        photo.content = photo_update.content.strip() or None
    if photo_update.music_url is not None:
        url = photo_update.music_url.strip()
        if url and not (
            url.startswith("https://") or url.startswith("/uploads/music/")
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid music_url",
            )
        photo.music_url = url or None

    await db.commit()
    await db.refresh(photo)

    return photo


@router.post("/{photo_id}/upload-edited", response_model=PhotoResponse)
async def upload_edited_photo(
    photo_id: UUID,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    topic: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload an edited photo file and update the photo record."""
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.user_id == current_user.id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")

    file_ext = os.path.splitext(file.filename or "photo.jpg")[1].lower() or ".jpg"
    if file_ext not in ALLOWED_EXTENSIONS:
        file_ext = ".jpg"

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
        )

    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    filename = f"{uuid4()}{file_ext}"
    file_path = os.path.join(user_dir, filename)
    try:
        async with await anyio.open_file(file_path, "wb") as f:
            await f.write(contents)
    except OSError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save file")

    photo.edited_url = f"/uploads/photos/{current_user.id}/{filename}"
    if topic is not None:
        trimmed = topic.strip()
        photo.topic = trimmed if trimmed else None

    await db.commit()
    await db.refresh(photo)
    return photo


class ChatMessage(BaseModel):
    role: str  # 'user' or 'ai'
    text: str


class ChatWriteRequest(BaseModel):
    message: str = Field(default="", max_length=500)
    history: list[ChatMessage] = Field(default_factory=list)
    topic: str = Field(default="", max_length=100)
    exchange_count: int = Field(default=0, ge=0)
    compile_story: bool = False


class ChatWriteResponse(BaseModel):
    reply: str


@router.post("/{photo_id}/chat-write", response_model=ChatWriteResponse)
async def chat_write(
    photo_id: UUID,
    payload: ChatWriteRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ChatWriteResponse:
    """Chat-based collaborative writing endpoint."""
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
        ).where(
            (Photo.user_id == current_user.id)
            | (current_user.role == "teacher")
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    reply = await chat_write_with_gemini(
        photo=photo,
        topic=payload.topic,
        message=payload.message,
        history=[{"role": m.role, "text": m.text} for m in payload.history],
        exchange_count=payload.exchange_count,
        compile_story=payload.compile_story,
    )
    return ChatWriteResponse(reply=reply)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    photo_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Delete a photo."""
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.user_id == current_user.id,
        )
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    # Delete file if it exists (with path traversal protection)
    safe_path = _safe_resolve_path(Path(UPLOAD_DIR).parent, photo.original_url)
    if safe_path and os.path.exists(safe_path):
        try:
            os.remove(safe_path)
        except OSError as e:
            logger.warning("Failed to delete photo file %s: %s", safe_path, e)

    # Delete edited file if it exists
    if photo.edited_url:
        safe_edited = _safe_resolve_path(Path(UPLOAD_DIR).parent, photo.edited_url)
        if safe_edited and os.path.exists(safe_edited):
            try:
                os.remove(safe_edited)
            except OSError as e:
                logger.warning("Failed to delete edited file %s: %s", safe_edited, e)

    # Delete related edit_history records first
    await db.execute(
        sa_delete(EditHistory).where(EditHistory.photo_id == photo_id)
    )

    await db.delete(photo)
    await db.commit()

    return None


@router.post(
    "/{photo_id}/recommend-sentences", response_model=SentenceRecommendationResponse
)
async def recommend_sentences(
    photo_id: UUID,
    payload: SentenceRecommendationRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Generate writing sentence recommendations from photo context and keywords."""
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.user_id == current_user.id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )

    request_keywords = _normalize_recommendation_keywords(payload.keywords)

    session_keywords: list[str] = []
    if photo.session_id:
        session_result = await db.execute(
            select(Session).where(
                Session.id == photo.session_id,
                Session.user_id == current_user.id,
            )
        )
        session_obj = session_result.scalar_one_or_none()
        if session_obj:
            session_keywords = [
                str(v).strip() for v in session_obj.keywords if str(v).strip()
            ]

    merged_keywords = list(dict.fromkeys([*request_keywords, *session_keywords]))[:10]
    topic = (photo.topic or "").strip() or (
        merged_keywords[0] if merged_keywords else "오늘의 순간"
    )

    return SentenceRecommendationResponse(
        topic=topic,
        keywords=merged_keywords,
        recommendations=_build_recommendation_sentences(topic, merged_keywords),
    )


@router.post("/{photo_id}/generate-draft", response_model=DraftGenerationResponse)
async def generate_draft(
    photo_id: UUID,
    payload: DraftGenerationRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI writing draft from photo, topic, keywords, and tone."""
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.user_id == current_user.id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )

    tone = payload.tone.strip()
    if tone not in SUPPORTED_TONES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported tone. Available tones: {', '.join(SUPPORTED_TONES)}",
        )

    request_keywords = _normalize_recommendation_keywords(payload.keywords)
    normalized_keywords = normalize_keywords(request_keywords)

    requested_topic = (payload.topic or "").strip()
    topic = (
        requested_topic
        or (photo.topic or "").strip()
        or (normalized_keywords[0] if normalized_keywords else "오늘의 순간")
    )

    try:
        generated_draft, source = await generate_draft_with_gemini(
            photo=photo,
            topic=topic,
            tone=tone,
            keywords=normalized_keywords,
            current_text=payload.current_text or "",
        )
    except httpx.HTTPStatusError as exc:
        provider_error = extract_provider_error_message(exc.response)
        if provider_error:
            logger.warning(
                "Gemini request failed: status=%s detail=%s",
                exc.response.status_code,
                provider_error,
            )
        else:
            logger.warning("Gemini request failed: status=%s", exc.response.status_code)
        generated_draft = build_fallback_draft(
            topic=topic,
            tone=tone,
            keywords=normalized_keywords,
            current_text=payload.current_text or "",
        )
        source = "fallback"
    except httpx.HTTPError:
        generated_draft = build_fallback_draft(
            topic=topic,
            tone=tone,
            keywords=normalized_keywords,
            current_text=payload.current_text or "",
        )
        source = "fallback"

    return DraftGenerationResponse(
        topic=topic,
        keywords=normalized_keywords,
        tone=tone,
        draft=clamp_text_lines(generated_draft, max_lines=5),
        source=source,
    )
