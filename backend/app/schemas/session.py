"""Session schemas for API validation and serialization."""

import datetime as dt
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    """Schema for creating a new session."""

    title: str = Field(..., max_length=255, description="Session title")
    location: str | None = Field(None, max_length=255, description="Session location")
    date: dt.date = Field(..., description="Session date (YYYY-MM-DD)")
    keywords: list[str] = Field(default_factory=list, max_length=10)


class SessionResponse(BaseModel):
    """Schema for session response."""

    id: UUID
    user_id: UUID
    title: str | None
    location: str | None
    date: dt.date
    keywords: list[str]
    created_at: dt.datetime

    model_config = ConfigDict(from_attributes=True)


class SessionKeywordsUpdate(BaseModel):
    keywords: list[str] = Field(default_factory=list, max_length=10)
