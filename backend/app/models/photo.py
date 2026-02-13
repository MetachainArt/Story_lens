# @TASK P0-T0.2 - 사진 테이블 정의
# @SPEC docs/planning/04-database-design.md#photos-table
"""Photo model for storing photo information."""

from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from uuid import UUID as PyUUID, uuid4
from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

if TYPE_CHECKING:
    from .session import Session
    from .user import User


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    user_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    session_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True
    )
    original_url: Mapped[str] = mapped_column(String(500), nullable=False)
    edited_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    topic: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now_naive, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=_utc_now_naive,
        onupdate=_utc_now_naive,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", backref="photos")
    session: Mapped["Session"] = relationship("Session", backref="photos")

    __table_args__ = (
        Index("idx_photos_user_id", "user_id"),
        Index("idx_photos_session_id", "session_id"),
    )
