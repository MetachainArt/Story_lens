# @TASK P0-T0.2 - 사용자 테이블 정의
# @SPEC docs/planning/04-database-design.md#users-table
"""User model for authentication and authorization."""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        SQLEnum('teacher', 'student', name='user_role'), nullable=False
    )
    teacher_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id'), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    students: Mapped[list["User"]] = relationship(
        "User", back_populates="teacher", foreign_keys=[teacher_id]
    )
    teacher: Mapped[Optional["User"]] = relationship(
        "User", back_populates="students", remote_side=[id], foreign_keys=[teacher_id]
    )

    __table_args__ = (
        Index('idx_users_email', 'email', unique=True),
        Index('idx_users_teacher_id', 'teacher_id'),
    )
