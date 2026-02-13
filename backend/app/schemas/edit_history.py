# @TASK P2-R4-T1 - EditHistory API 스키마
# @SPEC docs/planning/05-api-design.md#edit-history-api
"""EditHistory schemas for API requests and responses."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class EditHistoryBase(BaseModel):
    """Base edit history schema with common fields."""

    filter_name: Optional[str] = Field(
        None, max_length=50, description="Filter name applied"
    )
    adjustments: Optional[dict[str, object]] = Field(
        None, description="Adjustment values (brightness, saturation, etc.)"
    )
    crop_data: Optional[dict[str, object]] = Field(
        None, description="Crop parameters (x, y, width, height, rotation, etc.)"
    )


class EditHistoryCreate(EditHistoryBase):
    """Schema for creating a new edit history entry."""

    pass


class EditHistoryInDB(EditHistoryBase):
    """Edit history schema as stored in database."""

    id: UUID
    photo_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EditHistoryResponse(EditHistoryInDB):
    """Edit history schema for API responses."""

    pass
