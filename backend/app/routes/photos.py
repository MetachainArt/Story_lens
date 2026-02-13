# @TASK P2-R2-T1 - Photos API 라우트
# @SPEC docs/planning/05-api-design.md#photos-api
"""Photos API endpoints."""

import logging
import os
from pathlib import Path
from typing import List, Optional
from uuid import UUID, uuid4

import anyio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.deps import CurrentUser
from app.models.photo import Photo
from app.models.session import Session
from app.schemas.photo import PhotoResponse, PhotoUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/photos", tags=["photos"])

UPLOAD_DIR = "uploads/photos"
MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def _safe_resolve_path(base_dir: str, url_path: str) -> str | None:
    """Resolve a URL path to a safe filesystem path under base_dir.
    Returns None if the path escapes the base directory."""
    cleaned = url_path.lstrip("/")
    base_path = Path(base_dir).resolve()
    resolved_path = Path(cleaned).resolve()
    try:
        resolved_path.relative_to(base_path)
    except ValueError:
        return None
    return str(resolved_path)


@router.post("", response_model=PhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    topic: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
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

    # Validate session_id if provided
    session_uuid = None
    if session_id:
        try:
            session_uuid = UUID(session_id)
            # Check if session exists and belongs to user
            result = await db.execute(
                select(Session).where(
                    Session.id == session_uuid, Session.user_id == current_user.id
                )
            )
            session_obj = result.scalar_one_or_none()
            if not session_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Session not found or does not belong to you",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid session_id format",
            )

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
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
    skip: int = 0,
    limit: int = 50,
):
    """Get list of user's photos."""
    limit = min(limit, 100)
    result = await db.execute(
        select(Photo)
        .where(Photo.user_id == current_user.id)
        .order_by(Photo.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    photos = result.scalars().all()
    return photos


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    """Get a single photo by ID."""
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

    return photo


@router.put("/{photo_id}", response_model=PhotoResponse)
async def update_photo(
    photo_id: UUID,
    photo_update: PhotoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
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
        if not photo_update.edited_url.startswith("/uploads/photos/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid edited_url"
            )
        photo.edited_url = photo_update.edited_url

    await db.commit()
    await db.refresh(photo)

    return photo


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    photo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
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
    safe_path = _safe_resolve_path("uploads", photo.original_url)
    if safe_path and os.path.exists(safe_path):
        try:
            os.remove(safe_path)
        except OSError as e:
            logger.warning("Failed to delete photo file %s: %s", safe_path, e)

    # Delete edited file if it exists
    if photo.edited_url:
        safe_edited = _safe_resolve_path("uploads", photo.edited_url)
        if safe_edited and os.path.exists(safe_edited):
            try:
                os.remove(safe_edited)
            except OSError as e:
                logger.warning("Failed to delete edited file %s: %s", safe_edited, e)

    await db.delete(photo)
    await db.commit()

    return None
