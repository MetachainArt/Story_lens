"""User schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator

from app.schemas.auth import can_manage_templates, validate_password


class UserBase(BaseModel):
    """Base user schema."""

    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr


class UserCreate(BaseModel):
    """Schema for creating a student account."""

    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return validate_password(value)


class UserUpdate(BaseModel):
    """Schema for updating user profile."""

    name: Optional[str] = None


class UserResponse(BaseModel):
    """Schema for user response."""

    id: UUID
    name: str
    email: str
    role: str
    teacher_id: Optional[UUID] = None
    is_active: bool
    privacy_consent_at: Optional[datetime] = None
    privacy_policy_version: Optional[str] = None
    created_at: datetime

    @computed_field
    @property
    def can_manage_templates(self) -> bool:
        return can_manage_templates(self.email, self.role)

    model_config = ConfigDict(from_attributes=True)


class PrivacyConsentRequest(BaseModel):
    """Explicit account-holder consent for photo storage and AI processing."""

    accepted: bool


class PrivacyStatusResponse(BaseModel):
    policy_version: str
    consent_required: bool
    consented_at: Optional[datetime] = None
    retention_days: int
