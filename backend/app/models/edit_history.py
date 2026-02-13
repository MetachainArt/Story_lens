# @TASK P0-T0.2 - 편집 이력 테이블 정의
# @SPEC docs/planning/04-database-design.md#edit-history-table
"""EditHistory model for tracking photo edits."""

from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from uuid import UUID as PyUUID, uuid4
from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db.base import Base

if TYPE_CHECKING:
    from .photo import Photo


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EditHistory(Base):
    __tablename__ = "edit_history"

    id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    photo_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("photos.id"), nullable=False
    )
    filter_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    adjustments: Mapped[Optional[dict[str, object]]] = mapped_column(
        JSONB, nullable=True
    )
    crop_data: Mapped[Optional[dict[str, object]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now_naive, nullable=False
    )

    # Relationships
    photo: Mapped["Photo"] = relationship("Photo", backref="edit_histories")

    __table_args__ = (Index("idx_edit_history_photo_id", "photo_id"),)
