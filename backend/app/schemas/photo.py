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

    edited_url: Optional[str] = Field(None)
    title: Optional[str] = Field(None, max_length=255)
    topic: Optional[str] = Field(None, max_length=100)
    content: Optional[str] = Field(None, max_length=5000)
    music_url: Optional[str] = Field(None, max_length=1000)


class PhotoInDB(PhotoBase):
    """Photo schema as stored in database."""

    id: UUID
    user_id: UUID
    original_url: str
    edited_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    content: Optional[str] = None
    music_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PhotoResponse(PhotoInDB):
    """Photo schema for API responses."""

    pass


class SentenceRecommendationRequest(BaseModel):
    """Input payload for photo-based sentence recommendation."""

    keywords: list[str] = Field(default_factory=list, max_length=10)


class SentenceRecommendationResponse(BaseModel):
    """Recommended starter/follow-up sentences for writing."""

    topic: str
    keywords: list[str]
    recommendations: list[str]


class DraftGenerationRequest(BaseModel):
    """Input payload for AI draft generation."""

    topic: Optional[str] = Field(default=None, max_length=100)
    keywords: list[str] = Field(default_factory=list, max_length=10)
    tone: str = Field(..., min_length=1, max_length=30)
    current_text: Optional[str] = Field(default=None, max_length=2000)


class DraftGenerationResponse(BaseModel):
    """Generated writing draft for the selected photo."""

    topic: str
    keywords: list[str]
    tone: str
    draft: str
    source: str
