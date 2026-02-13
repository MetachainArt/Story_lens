"""Sessions API endpoints."""

from datetime import date as dt_date
from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ...db.session import get_db
from ...core.deps import CurrentUser
from ...models.session import Session
from ...schemas.session import SessionCreate, SessionKeywordsUpdate, SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _normalize_keywords(raw_keywords: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()

    for keyword in raw_keywords:
        item = keyword.strip()
        if not item:
            continue
        if len(item) > 30:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Each keyword must be at most 30 characters",
            )
        lower = item.lower()
        if lower in seen:
            continue
        normalized.append(item)
        seen.add(lower)

    if len(normalized) > 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="A session can have up to 10 keywords",
        )

    return normalized


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
        keywords=_normalize_keywords(session_data.keywords),
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
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
):
    """List all sessions for the current user.

    Requires authentication. Returns only sessions belonging to the current user.
    """
    if month is not None and year is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="year is required when month is provided",
        )

    limit = min(limit, 100)
    query = select(Session).where(Session.user_id == current_user.id)

    if year is not None and month is None:
        year_start = dt_date(year, 1, 1)
        next_year_start = dt_date(year + 1, 1, 1)
        query = query.where(Session.date >= year_start, Session.date < next_year_start)

    if year is not None and month is not None:
        month_start = dt_date(year, month, 1)
        if month == 12:
            next_month_start = dt_date(year + 1, 1, 1)
        else:
            next_month_start = dt_date(year, month + 1, 1)
        query = query.where(
            Session.date >= month_start, Session.date < next_month_start
        )

    result = await db.execute(
        query.order_by(Session.date.asc(), Session.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    sessions = result.scalars().all()

    return sessions


@router.patch("/{session_id}/keywords", response_model=SessionResponse)
async def update_session_keywords(
    session_id: UUID,
    payload: SessionKeywordsUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update theme keywords for a session."""
    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )

    session.keywords = _normalize_keywords(payload.keywords)
    await db.commit()
    await db.refresh(session)

    return session
