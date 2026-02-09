"""Authentication schemas."""
from uuid import UUID
from pydantic import BaseModel, EmailStr


class UserInToken(BaseModel):
    """User data returned in login response."""
    id: UUID
    name: str
    email: str
    role: str

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    """Login request schema."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response with tokens and user data."""
    access_token: str
    refresh_token: str
    user: UserInToken


class RefreshRequest(BaseModel):
    """Refresh token request schema."""
    refresh_token: str


class RefreshResponse(BaseModel):
    """Refresh token response schema."""
    access_token: str
    refresh_token: str


class LogoutResponse(BaseModel):
    """Logout response schema."""
    message: str


class TokenPayload(BaseModel):
    """JWT token payload."""
    sub: str
    exp: int | None = None
    type: str | None = None  # "access" or "refresh"


# Legacy schemas for compatibility
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
