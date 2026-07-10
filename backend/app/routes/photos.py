# @TASK P2-R2-T1 - Photos API 라우트
# @SPEC docs/planning/05-api-design.md#photos-api
"""Photos API endpoints."""

import base64
import binascii
import logging
import os
from datetime import timedelta
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
from sqlalchemy import delete as sa_delete, select, update

from ..db.session import get_db
from ..core.config import settings
from ..core.deps import CurrentUser
from ..core.privacy import photo_retention_values, require_photo_processing_consent
from ..core.rate_limit import rate_limit
from ..core.security import create_media_token
from ..models.edit_history import EditHistory
from ..models.ai_templates import ImageGenerationJob
from ..models.photo import Photo
from ..models.session import Session
from ..models.user import User
from ..schemas.photo import (
    DraftGenerationRequest,
    DraftGenerationResponse,
    PhotoResponse,
    PhotoPageResponse,
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
from ..services.image_validation import (
    ImageValidationError,
    validate_image_bytes,
    validate_image_file,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/photos", tags=["photos"])

UPLOAD_DIR = str((Path(__file__).resolve().parents[2] / "uploads" / "photos").resolve())
MAX_UPLOAD_SIZE = settings.MAX_IMAGE_UPLOAD_BYTES


class PhotoDownloadUrlResponse(BaseModel):
    url: str
    expires_in_seconds: int


def _invalid_image(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=detail,
    )


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


def _remove_local_photo_file(url_path: str | None) -> None:
    if not url_path:
        return
    safe_path = _safe_resolve_path(Path(UPLOAD_DIR).parent, url_path)
    if not safe_path:
        return
    try:
        Path(safe_path).unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("Failed to remove photo file %s: %s", safe_path, exc)


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
    if not mime_type.startswith("image/"):
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

    try:
        image_info = validate_image_bytes(
            decoded_bytes,
            declared_mime=mime_type,
        )
    except ImageValidationError as exc:
        raise _invalid_image(str(exc))

    user_dir = os.path.join(UPLOAD_DIR, str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    filename = f"{uuid4()}{image_info.extension}"
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


async def _resolve_viewable_user_id(
    db: AsyncSession, viewer: User, student_id: str | None
) -> UUID:
    """Return the user id whose photos `viewer` is allowed to list.

    Authorization rules (no cross-user leakage):
    - Anyone may view their own photos.
    - A teacher may view a student they manage (``student.teacher_id == teacher.id``).
    - No other cross-user access is granted. Parents currently have no link to a
      child, so they only see their own photos until a parent_child link model
      exists. This intentionally replaces the previous unfiltered ``select(Photo)``
      that leaked every photo in the system.
    """
    if not student_id:
        return viewer.id

    try:
        student_uuid = UUID(student_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Student not found"
        )

    if student_uuid == viewer.id:
        return viewer.id

    if viewer.role == "teacher":
        result = await db.execute(
            select(User.id).where(
                User.id == student_uuid,
                User.role == "student",
                User.teacher_id == viewer.id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Student not found"
            )
        return student_uuid

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
    )


def _photo_query_for_period(
    target_user_id: UUID,
    year: int | None,
    month: int | None,
):
    if month is not None and year is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="year is required when month is provided",
        )

    query = select(Photo).where(Photo.user_id == target_user_id)
    if year is None:
        return query

    from datetime import date as dt_date

    period_start = dt_date(year, month or 1, 1)
    if month is None or month == 12:
        period_end = dt_date(year + 1, 1, 1)
    else:
        period_end = dt_date(year, month + 1, 1)
    return query.where(
        Photo.updated_at >= period_start,
        Photo.updated_at < period_end,
    )


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
    require_photo_processing_consent(current_user)

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

    # Stream into a non-public temporary name, decode it, then atomically move
    # it to an extension derived from the actual image format.
    temporary_path = Path(user_dir) / f".{uuid4()}.upload"

    # Save file as stream to avoid loading entire body in memory
    try:
        written_size = 0
        chunk_size = 1024 * 1024
        await file.seek(0)
        async with await anyio.open_file(temporary_path, "wb") as out_file:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                written_size += len(chunk)
                if written_size > MAX_UPLOAD_SIZE:
                    await out_file.aclose()
                    try:
                        os.remove(temporary_path)
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
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file",
        )

    try:
        image_info = validate_image_file(
            temporary_path,
            declared_mime=file.content_type,
        )
    except ImageValidationError as exc:
        temporary_path.unlink(missing_ok=True)
        raise _invalid_image(str(exc))

    filename = f"{uuid4()}{image_info.extension}"
    file_path = Path(user_dir) / filename
    try:
        temporary_path.replace(file_path)
    except OSError:
        temporary_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file",
        )

    # Create photo record
    original_url = f"/uploads/photos/{current_user.id}/{filename}"
    expires_at, retention_days = photo_retention_values()
    photo = Photo(
        user_id=current_user.id,
        session_id=session_uuid,
        original_url=original_url,
        title=title,
        topic=topic.strip() if topic and topic.strip() else None,
        expires_at=expires_at,
        retention_days=retention_days,
    )

    db.add(photo)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        file_path.unlink(missing_ok=True)
        logger.exception("Failed to save uploaded photo metadata")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save photo",
        )
    await db.refresh(photo)

    return photo


@router.get("", response_model=List[PhotoResponse])
async def get_photos(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    student_id: str | None = Query(default=None),
):
    """Get list of user's photos. Teachers/parents can view all photos via student_id."""
    target_user_id = await _resolve_viewable_user_id(db, current_user, student_id)
    query = _photo_query_for_period(target_user_id, year, month)

    result = await db.execute(
        query.order_by(Photo.updated_at.desc()).offset(skip).limit(limit)
    )
    photos = result.scalars().all()
    return photos


@router.get("/page", response_model=PhotoPageResponse)
async def get_photo_page(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=50),
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    student_id: str | None = Query(default=None),
):
    """Return one bounded gallery page without an expensive total-count query."""
    target_user_id = await _resolve_viewable_user_id(db, current_user, student_id)
    query = _photo_query_for_period(target_user_id, year, month)
    result = await db.execute(
        query.order_by(Photo.updated_at.desc(), Photo.id.desc())
        .offset(offset)
        .limit(limit + 1)
    )
    rows = list(result.scalars())
    has_more = len(rows) > limit
    items = rows[:limit]
    return PhotoPageResponse(
        items=items,
        next_offset=offset + len(items) if has_more else None,
    )


async def _get_photo_for_viewer(
    db: AsyncSession,
    photo_id: UUID,
    current_user: User,
) -> Photo:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    # Allow access only to the owner, or a teacher viewing a student they manage.
    if photo.user_id != current_user.id:
        if current_user.role == "teacher":
            owner_result = await db.execute(
                select(User.id).where(
                    User.id == photo.user_id,
                    User.role == "student",
                    User.teacher_id == current_user.id,
                )
            )
            if owner_result.scalar_one_or_none() is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
            )

    return photo


@router.get("/{photo_id}/download-url", response_model=PhotoDownloadUrlResponse)
async def get_photo_download_url(
    photo_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return a short-lived signed media URL for mobile in-app browsers."""
    photo = await _get_photo_for_viewer(db, photo_id, current_user)
    media_path = photo.edited_url or photo.original_url

    if not media_path.startswith("/uploads/photos/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Photo cannot be downloaded"
        )

    normalized_path = media_path.lstrip("/")
    expires_in_seconds = 10 * 60
    token = create_media_token(
        normalized_path,
        expires_delta=timedelta(seconds=expires_in_seconds),
    )
    return PhotoDownloadUrlResponse(
        url=f"/api/v1/media/{normalized_path}?token={token}",
        expires_in_seconds=expires_in_seconds,
    )


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Get a single photo by ID. Teachers can view any student's photo."""
    return await _get_photo_for_viewer(db, photo_id, current_user)


@router.put("/{photo_id}", response_model=PhotoResponse)
async def update_photo(
    photo_id: UUID,
    photo_update: PhotoUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Update a photo (for saving edits)."""
    if photo_update.edited_url is not None:
        require_photo_processing_consent(current_user)
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

    old_edited_url = photo.edited_url
    newly_saved_url: str | None = None

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
            newly_saved_url = _save_data_url_image(
                photo_update.edited_url, current_user.id
            )
            photo.edited_url = newly_saved_url
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

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        _remove_local_photo_file(newly_saved_url)
        logger.exception("Failed to update photo metadata")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save photo",
        )
    await db.refresh(photo)

    if (
        photo_update.edited_url is not None
        and old_edited_url
        and old_edited_url != photo.edited_url
        and old_edited_url != photo.original_url
    ):
        _remove_local_photo_file(old_edited_url)

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
    require_photo_processing_consent(current_user)
    result = await db.execute(
        select(Photo).where(
            Photo.id == photo_id,
            Photo.user_id == current_user.id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
        )

    try:
        image_info = validate_image_bytes(
            contents,
            declared_mime=file.content_type,
        )
    except ImageValidationError as exc:
        raise _invalid_image(str(exc))

    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)
    filename = f"{uuid4()}{image_info.extension}"
    file_path = os.path.join(user_dir, filename)
    try:
        async with await anyio.open_file(file_path, "wb") as f:
            await f.write(contents)
    except OSError:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save file")

    old_edited_url = photo.edited_url
    new_edited_url = f"/uploads/photos/{current_user.id}/{filename}"
    photo.edited_url = new_edited_url
    if topic is not None:
        trimmed = topic.strip()
        photo.topic = trimmed if trimmed else None

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        _remove_local_photo_file(new_edited_url)
        logger.exception("Failed to save edited photo metadata")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save photo",
        )
    await db.refresh(photo)
    if old_edited_url and old_edited_url not in {photo.original_url, new_edited_url}:
        _remove_local_photo_file(old_edited_url)
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


@router.post(
    "/{photo_id}/chat-write",
    response_model=ChatWriteResponse,
    dependencies=[Depends(rate_limit(30, 60))],
)
async def chat_write(
    photo_id: UUID,
    payload: ChatWriteRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> ChatWriteResponse:
    """Chat-based collaborative writing endpoint."""
    require_photo_processing_consent(current_user)
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()
    if photo is not None and photo.user_id != current_user.id:
        # Only the owner, or a teacher managing the photo's owner, may use the
        # writing assistant on it. (Previously `| (role == "teacher")` injected a
        # Python bool into the query, granting every teacher access to any photo.)
        if current_user.role == "teacher":
            owner_result = await db.execute(
                select(User.id).where(
                    User.id == photo.user_id,
                    User.role == "student",
                    User.teacher_id == current_user.id,
                )
            )
            if owner_result.scalar_one_or_none() is None:
                photo = None
        else:
            photo = None
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

    original_url = photo.original_url
    edited_url = photo.edited_url

    # Delete related rows and clear AI generation references before deleting the
    # photo row. AI-generated photos are referenced by image_generation_jobs, so
    # deleting the file first can leave a broken gallery row if the DB rejects
    # the photo delete.
    await db.execute(
        sa_delete(EditHistory).where(EditHistory.photo_id == photo_id)
    )
    await db.execute(
        update(ImageGenerationJob)
        .where(ImageGenerationJob.photo_id == photo_id)
        .values(photo_id=None, result_url=None)
    )
    await db.execute(
        update(ImageGenerationJob)
        .where(ImageGenerationJob.source_photo_id == photo_id)
        .values(source_photo_id=None)
    )

    await db.delete(photo)
    await db.commit()

    # Delete files after the DB commit. File cleanup is best-effort; a filesystem
    # failure should not resurrect the deleted photo in the gallery.
    safe_path = _safe_resolve_path(Path(UPLOAD_DIR).parent, original_url)
    if safe_path and os.path.exists(safe_path):
        try:
            os.remove(safe_path)
        except OSError as e:
            logger.warning("Failed to delete photo file %s: %s", safe_path, e)

    if edited_url:
        safe_edited = _safe_resolve_path(Path(UPLOAD_DIR).parent, edited_url)
        if safe_edited and os.path.exists(safe_edited):
            try:
                os.remove(safe_edited)
            except OSError as e:
                logger.warning("Failed to delete edited photo file %s: %s", safe_edited, e)

    return None


@router.post(
    "/{photo_id}/recommend-sentences",
    response_model=SentenceRecommendationResponse,
    dependencies=[Depends(rate_limit(30, 60))],
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


@router.post(
    "/{photo_id}/generate-draft",
    response_model=DraftGenerationResponse,
    dependencies=[Depends(rate_limit(30, 60))],
)
async def generate_draft(
    photo_id: UUID,
    payload: DraftGenerationRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Generate an AI writing draft from photo, topic, keywords, and tone."""
    require_photo_processing_consent(current_user)
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
