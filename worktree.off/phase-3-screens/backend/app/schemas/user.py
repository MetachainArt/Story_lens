"""User schemas."""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """Base user schema."""
    name: str
    email: EmailStr


class UserCreate(BaseModel):
    """Schema for creating a student account."""
    name: str
    email: EmailStr
    password: str


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
    created_at: datetime

    class Config:
        from_attributes = True
