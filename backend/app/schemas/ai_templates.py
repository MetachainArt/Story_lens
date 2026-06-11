"""Schemas for AI image templates, generation jobs, and creative assets."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    kind: str = Field(default="template", max_length=40)
    description: Optional[str] = Field(default=None, max_length=1000)
    sort_order: int = 0
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    slug: Optional[str] = Field(default=None, max_length=100)
    kind: Optional[str] = Field(default=None, max_length=40)
    description: Optional[str] = Field(default=None, max_length=1000)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryResponse(CategoryBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplateVariable(BaseModel):
    key: str = Field(..., min_length=1, max_length=60)
    label: str = Field(..., min_length=1, max_length=120)
    input_type: str = Field(default="choice", max_length=30)
    choices: list[str] = Field(default_factory=list)
    default_value: Optional[str] = None
    required: bool = True
    helper_text: Optional[str] = None


class PromptTemplateBase(BaseModel):
    category_id: Optional[UUID] = None
    name: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    thumbnail_url: Optional[str] = Field(default=None, max_length=500)
    base_prompt: str = Field(..., min_length=1, max_length=8000)
    variables: list[TemplateVariable] = Field(default_factory=list)
    default_values: dict[str, Any] = Field(default_factory=dict)
    negative_terms: list[str] = Field(default_factory=list)
    recommended_age: Optional[str] = Field(default=None, max_length=40)
    locale_labels: dict[str, Any] = Field(default_factory=dict)
    requires_source_photo: bool = True
    aspect_ratio: str = Field(default="1:1", max_length=20)
    visible_user_fields: list[str] = Field(default_factory=list)
    is_public: bool = True
    is_active: bool = True
    is_recommended: bool = False
    example_image_url: Optional[str] = Field(default=None, max_length=500)


class PromptTemplateCreate(PromptTemplateBase):
    pass


class PromptTemplateUpdate(BaseModel):
    category_id: Optional[UUID] = None
    name: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    thumbnail_url: Optional[str] = Field(default=None, max_length=500)
    base_prompt: Optional[str] = Field(default=None, max_length=8000)
    variables: Optional[list[TemplateVariable]] = None
    default_values: Optional[dict[str, Any]] = None
    negative_terms: Optional[list[str]] = None
    recommended_age: Optional[str] = Field(default=None, max_length=40)
    locale_labels: Optional[dict[str, Any]] = None
    requires_source_photo: Optional[bool] = None
    aspect_ratio: Optional[str] = Field(default=None, max_length=20)
    visible_user_fields: Optional[list[str]] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    is_recommended: Optional[bool] = None
    example_image_url: Optional[str] = Field(default=None, max_length=500)


class PromptTemplateResponse(PromptTemplateBase):
    id: UUID
    usage_count: int
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryResponse] = None

    model_config = ConfigDict(from_attributes=True)


class TemplateStatusUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    is_recommended: Optional[bool] = None


class CreativeAssetBase(BaseModel):
    category_id: Optional[UUID] = None
    asset_type: str = Field(..., max_length=40)
    name: str = Field(..., max_length=100)
    label: str = Field(..., max_length=100)
    asset_url: Optional[str] = Field(default=None, max_length=500)
    preview_url: Optional[str] = Field(default=None, max_length=500)
    payload: dict[str, Any] = Field(default_factory=dict)
    is_public: bool = True
    is_active: bool = True
    sort_order: int = 0


class CreativeAssetCreate(CreativeAssetBase):
    pass


class CreativeAssetUpdate(BaseModel):
    category_id: Optional[UUID] = None
    asset_type: Optional[str] = Field(default=None, max_length=40)
    name: Optional[str] = Field(default=None, max_length=100)
    label: Optional[str] = Field(default=None, max_length=100)
    asset_url: Optional[str] = Field(default=None, max_length=500)
    preview_url: Optional[str] = Field(default=None, max_length=500)
    payload: Optional[dict[str, Any]] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class CreativeAssetResponse(CreativeAssetBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdjustmentPresetBase(BaseModel):
    name: str = Field(..., max_length=80)
    label: str = Field(..., max_length=100)
    css_filter: str = Field(default="none", max_length=500)
    values: dict[str, Any] = Field(default_factory=dict)
    preview_url: Optional[str] = Field(default=None, max_length=500)
    is_public: bool = True
    is_active: bool = True
    sort_order: int = 0


class AdjustmentPresetCreate(AdjustmentPresetBase):
    pass


class AdjustmentPresetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    label: Optional[str] = Field(default=None, max_length=100)
    css_filter: Optional[str] = Field(default=None, max_length=500)
    values: Optional[dict[str, Any]] = None
    preview_url: Optional[str] = Field(default=None, max_length=500)
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class AdjustmentPresetResponse(AdjustmentPresetBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ImageGenerationRequest(BaseModel):
    template_id: UUID
    version_id: Optional[UUID] = None
    variable_values: dict[str, Any] = Field(default_factory=dict)
    source_photo_id: Optional[UUID] = None
    source_photo_ids: list[UUID] = Field(default_factory=list, max_length=4)
    provider_options: dict[str, Any] = Field(default_factory=dict)


class ImageGenerationResponse(BaseModel):
    job_id: UUID
    status: str
    photo_id: Optional[UUID] = None
    result_url: Optional[str] = None
    message: str = ""


class ImageGenerationJobResponse(BaseModel):
    id: UUID
    status: str
    provider: str
    provider_model: str
    template_id: UUID
    photo_id: Optional[UUID] = None
    result_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplateUsageResponse(BaseModel):
    template_id: UUID
    template_name: str
    usage_count: int
    last_used_at: Optional[datetime] = None
