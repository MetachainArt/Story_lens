# @TASK P2-R2-T1 - Photos API 라우트
# @SPEC docs/planning/05-api-design.md#photos-api
"""Photos API endpoints."""
import os
from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.deps import CurrentUser
from app.models.photo import Photo
from app.models.session import Session
from app.schemas.photo import PhotoResponse, PhotoUpdate

router = APIRouter(prefix="/photos", tags=["photos"])

UPLOAD_DIR = "uploads/photos"


@router.post("", response_model=PhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    """Upload a new photo."""
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )

    # Validate session_id if provided
    session_uuid = None
    if session_id:
        try:
            session_uuid = UUID(session_id)
            # Check if session exists and belongs to user
            result = await db.execute(
                select(Session).where(
                    Session.id == session_uuid,
                    Session.user_id == current_user.id
                )
            )
            session_obj = result.scalar_one_or_none()
            if not session_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Session not found or does not belong to you"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid session_id format"
            )

    # Create user directory if it doesn't exist
    user_dir = os.path.join(UPLOAD_DIR, str(current_user.id))
    os.makedirs(user_dir, exist_ok=True)

    # Generate unique filename
    file_ext = os.path.splitext(file.filename or "image.jpg")[1]
    filename = f"{uuid4()}{file_ext}"
    file_path = os.path.join(user_dir, filename)

    # Save file
    try:
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )

    # Create photo record
    original_url = f"/uploads/photos/{current_user.id}/{filename}"
    photo = Photo(
        user_id=current_user.id,
        session_id=session_uuid,
        original_url=original_url,
        title=title
    )

    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    return photo


@router.get("", response_model=List[PhotoResponse])
async def get_photos(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = None,
):
    """Get list of user's photos."""
    result = await db.execute(
        select(Photo)
        .where(Photo.user_id == current_user.id)
        .order_by(Photo.created_at.desc())
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
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    # Check ownership
    if photo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this photo"
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
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    # Check ownership
    if photo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this photo"
        )

    # Update fields
    if photo_update.title is not None:
        photo.title = photo_update.title
    if photo_update.edited_url is not None:
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
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    # Check ownership
    if photo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this photo"
        )

    # Delete file if it exists
    file_path = photo.original_url.lstrip("/")
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass  # Don't fail if file deletion fails

    # Delete edited file if it exists
    if photo.edited_url:
        edited_file_path = photo.edited_url.lstrip("/")
        if os.path.exists(edited_file_path):
            try:
                os.remove(edited_file_path)
            except Exception:
                pass

    await db.delete(photo)
    await db.commit()

    return None
