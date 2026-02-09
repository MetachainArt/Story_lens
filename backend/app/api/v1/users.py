"""User endpoints.

@TASK P1-R2-T1 - Users API
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.schemas.user import UserResponse, UserCreate
from app.core.deps import CurrentUser, RequireTeacher
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
):
    """List all students created by the current teacher.

    Only teachers can access this endpoint.
    Returns only the students associated with the authenticated teacher.
    """
    result = await db.execute(
        select(User).where(
            User.teacher_id == current_teacher.id,
            User.role == "student"
        )
    )
    students = result.scalars().all()

    return students
