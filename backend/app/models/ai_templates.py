"""AI image template and creative asset models."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID as PyUUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db.base import Base


def _utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    kind: Mapped[str] = mapped_column(String(40), nullable=False, default="template")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now_naive, onupdate=_utc_now_naive, nullable=False
    )

    __table_args__ = (Index("idx_categories_kind_active", "kind", "is_active"),)


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    category_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    base_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list[dict[str, object]]] = mapped_column(JSONB, default=list, nullable=False)
    default_values: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    negative_terms: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    recommended_age: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    locale_labels: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    requires_source_photo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    aspect_ratio: Mapped[str] = mapped_column(String(20), default="1:1", nullable=False)
    visible_user_fields: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_recommended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    example_image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now_naive, onupdate=_utc_now_naive, nullable=False
    )

    category: Mapped[Optional[Category]] = relationship("Category")
    versions: Mapped[list["PromptTemplateVersion"]] = relationship(
        "PromptTemplateVersion", back_populates="template", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_prompt_templates_category", "category_id"),
        Index("idx_prompt_templates_public_active", "is_public", "is_active"),
        Index("idx_prompt_templates_recommended", "is_recommended"),
    )


class PromptTemplateVersion(Base):
    __tablename__ = "prompt_template_versions"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_templates.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    base_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list[dict[str, object]]] = mapped_column(JSONB, default=list, nullable=False)
    default_values: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    negative_terms: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, nullable=False)

    template: Mapped[PromptTemplate] = relationship("PromptTemplate", back_populates="versions")

    __table_args__ = (Index("idx_prompt_template_versions_template", "template_id", "version_number"),)


class CreativeAsset(Base):
    __tablename__ = "creative_assets"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    category_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True
    )
    asset_type: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    asset_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    preview_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now_naive, onupdate=_utc_now_naive, nullable=False
    )

    category: Mapped[Optional[Category]] = relationship("Category")

    __table_args__ = (Index("idx_creative_assets_type_active", "asset_type", "is_active"),)


class AdjustmentPreset(Base):
    __tablename__ = "adjustment_presets"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    css_filter: Mapped[str] = mapped_column(String(500), nullable=False, default="none")
    values: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    preview_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, nullable=False)


class ImageGenerationJob(Base):
    __tablename__ = "image_generation_jobs"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    template_id: Mapped[PyUUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_templates.id"), nullable=False
    )
    version_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_template_versions.id"), nullable=True
    )
    source_photo_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("photos.id"), nullable=True
    )
    photo_id: Mapped[Optional[PyUUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("photos.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    provider_model: Mapped[str] = mapped_column(String(100), nullable=False)
    provider_task_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    variable_values: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    provider_options: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    result_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utc_now_naive, onupdate=_utc_now_naive, nullable=False
    )

    template: Mapped[PromptTemplate] = relationship("PromptTemplate")

    __table_args__ = (Index("idx_image_generation_jobs_user_status", "user_id", "status"),)


class TemplateUsageEvent(Base):
    __tablename__ = "template_usage_events"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("prompt_templates.id"), nullable=False)
    user_id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    job_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("image_generation_jobs.id"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False, default="generate")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, nullable=False)

    __table_args__ = (Index("idx_template_usage_template_created", "template_id", "created_at"),)


class SafetyEvent(Base):
    __tablename__ = "safety_events"

    id: Mapped[PyUUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[Optional[PyUUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    template_id: Mapped[Optional[PyUUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prompt_templates.id"), nullable=True
    )
    reason: Mapped[str] = mapped_column(String(120), nullable=False)
    input_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now_naive, nullable=False)

    __table_args__ = (Index("idx_safety_events_created", "created_at"),)
