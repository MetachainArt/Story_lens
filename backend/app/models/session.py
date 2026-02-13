# @TASK P0-T0.2 - 촬영 세션 테이블 정의
# @SPEC docs/planning/04-database-design.md#sessions-table
"""Session model for photo shooting sessions."""

from datetime import datetime, date, timezone
from typing import Optional, TYPE_CHECKING
from uuid import UUID as PyUUID, uuid4
from sqlalchemy import String, DateTime, Date, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

if TYPE_CHECKING:
    from .user import User


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now_naive, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", backref="sessions")

    __table_args__ = (Index("idx_sessions_user_id", "user_id"),)
