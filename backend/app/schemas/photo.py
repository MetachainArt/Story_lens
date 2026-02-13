# @TASK P2-R2-T1 - Photos API 스키마
# @SPEC docs/planning/05-api-design.md#photos-api
"""Photo schemas for API requests and responses."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class PhotoBase(BaseModel):
    """Base photo schema with common fields."""

    title: Optional[str] = Field(None, max_length=255)
    topic: Optional[str] = Field(None, max_length=100)
    session_id: Optional[UUID] = None


class PhotoCreate(PhotoBase):
    """Schema for creating a new photo (multipart/form-data)."""

    pass


class PhotoUpdate(BaseModel):
    """Schema for updating a photo."""

    edited_url: Optional[str] = Field(None, max_length=500)
    title: Optional[str] = Field(None, max_length=255)
    topic: Optional[str] = Field(None, max_length=100)


class PhotoInDB(PhotoBase):
    """Photo schema as stored in database."""

    id: UUID
    user_id: UUID
    original_url: str
    edited_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PhotoResponse(PhotoInDB):
    """Photo schema for API responses."""

    pass
