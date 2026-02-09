"""Session schemas for API validation and serialization."""
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    """Schema for creating a new session."""
    title: str = Field(..., max_length=255, description="Session title")
    location: str | None = Field(None, max_length=255, description="Session location")
    date: date = Field(..., description="Session date (YYYY-MM-DD)")


class SessionResponse(BaseModel):
    """Schema for session response."""
    id: UUID
    user_id: UUID
    title: str | None
    location: str | None
    date: date
    created_at: datetime

    class Config:
        from_attributes = True
