# @TASK P2-R4-T1 - EditHistory API 라우트
# @SPEC docs/planning/05-api-design.md#edit-history-api
"""EditHistory routes for photo edit tracking."""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.photo import Photo
from app.models.edit_history import EditHistory
from app.schemas.edit_history import (
    EditHistoryCreate,
    EditHistoryResponse
)

router = APIRouter()


async def get_photo_and_verify_ownership(
    photo_id: UUID,
    current_user: User,
    db: AsyncSession
) -> Photo:
    """Verify that photo exists and belongs to current user."""
    result = await db.execute(
        select(Photo).where(Photo.id == photo_id)
    )
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found"
        )

    if photo.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access edit history for your own photos"
        )

    return photo


@router.get("/photos/{photo_id}/edits", response_model=List[EditHistoryResponse])
async def get_edit_history_list(
    photo_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get edit history list for a photo.

    Returns edit history entries in descending order (latest first).
    Only the photo owner can access the edit history.
    """
    # Verify photo ownership
    await get_photo_and_verify_ownership(photo_id, current_user, db)

    # Get edit history list
    result = await db.execute(
        select(EditHistory)
        .where(EditHistory.photo_id == photo_id)
        .order_by(EditHistory.created_at.desc())
    )
    edits = result.scalars().all()

    return edits


@router.post(
    "/photos/{photo_id}/edits",
    response_model=EditHistoryResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_edit_history(
    photo_id: UUID,
    edit_data: EditHistoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new edit history entry for a photo.

    Saves the filter, adjustments, and crop data applied to the photo.
    Only the photo owner can create edit history entries.
    """
    # Verify photo ownership
    await get_photo_and_verify_ownership(photo_id, current_user, db)

    # Create edit history entry
    edit_history = EditHistory(
        photo_id=photo_id,
        filter_name=edit_data.filter_name,
        adjustments=edit_data.adjustments,
        crop_data=edit_data.crop_data
    )

    db.add(edit_history)
    await db.commit()
    await db.refresh(edit_history)

    return edit_history
