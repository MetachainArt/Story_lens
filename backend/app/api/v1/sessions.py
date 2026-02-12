"""Sessions API endpoints."""
from typing import Annotated, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.deps import CurrentUser
from app.models.session import Session
from app.schemas.session import SessionCreate, SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    session_data: SessionCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new shooting session.

    Requires authentication. The session will be associated with the current user.
    """
    # Create new session
    new_session = Session(
        user_id=current_user.id,
        title=session_data.title,
        location=session_data.location,
        date=session_data.date,
    )

    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    return new_session


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = 0,
    limit: int = 50,
):
    """List all sessions for the current user.

    Requires authentication. Returns only sessions belonging to the current user.
    """
    limit = min(limit, 100)
    result = await db.execute(
        select(Session)
        .where(Session.user_id == current_user.id)
        .order_by(Session.created_at.desc())
        .offset(skip).limit(limit)
    )
    sessions = result.scalars().all()

    return sessions
