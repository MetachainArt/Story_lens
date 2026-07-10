"""User endpoints.

@TASK P1-R2-T1 - Users API
"""
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.schemas.user import (
    PrivacyConsentRequest,
    PrivacyStatusResponse,
    UserResponse,
    UserCreate,
)
from app.core.deps import CurrentUser, RequireTeacher
from app.core.config import settings
from app.core.privacy import has_current_photo_consent
from app.models.user import User
from app.core.security import get_password_hash

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: CurrentUser):
    """Get current user's profile.

    Accessible by both teachers and students.
    Returns the authenticated user's information.
    """
    return current_user


def _privacy_status(user: User) -> PrivacyStatusResponse:
    return PrivacyStatusResponse(
        policy_version=settings.PRIVACY_POLICY_VERSION,
        consent_required=not has_current_photo_consent(user),
        consented_at=user.privacy_consent_at,
        retention_days=max(settings.PHOTO_RETENTION_DAYS, 0),
    )


@router.get("/me/privacy-status", response_model=PrivacyStatusResponse)
async def get_privacy_status(current_user: CurrentUser):
    """Return the current photo-processing consent and retention policy."""
    return _privacy_status(current_user)


@router.post("/me/privacy-consent", response_model=PrivacyStatusResponse)
async def accept_privacy_policy(
    payload: PrivacyConsentRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Record explicit consent for private photo storage and AI processing."""
    if payload.accepted is not True:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="동의 여부를 확인해 주세요.",
        )
    current_user.privacy_consent_at = datetime.now(timezone.utc)
    current_user.privacy_policy_version = settings.PRIVACY_POLICY_VERSION
    await db.commit()
    await db.refresh(current_user)
    return _privacy_status(current_user)


@router.delete("/me/privacy-consent", response_model=PrivacyStatusResponse)
async def withdraw_privacy_consent(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Withdraw consent; existing photos remain available for manual deletion."""
    current_user.privacy_consent_at = None
    current_user.privacy_policy_version = None
    await db.commit()
    await db.refresh(current_user)
    return _privacy_status(current_user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    user_in: UserCreate,
    current_teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new student account.

    Only teachers can create student accounts.
    The student will be automatically associated with the teacher.
    """
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Create new student
    new_student = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role="student",
        teacher_id=current_teacher.id,
        is_active=True,
    )

    db.add(new_student)
    await db.commit()
    await db.refresh(new_student)

    return new_student


@router.get("", response_model=list[UserResponse])
async def list_students(
    current_teacher: RequireTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    """List only students assigned to the authenticated teacher."""
    if current_teacher.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="담당 교사만 학생 목록을 볼 수 있습니다.",
        )
    result = await db.execute(
        select(User).where(
            User.role == "student",
            User.teacher_id == current_teacher.id,
            User.is_active.is_(True),
        ).order_by(User.name.asc(), User.created_at.asc()).offset(skip).limit(limit)
    )
    students = result.scalars().all()

    return students
