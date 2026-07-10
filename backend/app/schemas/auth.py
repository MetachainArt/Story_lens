"""Authentication schemas."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, computed_field, field_validator

from app.core.config import settings

# bcrypt silently truncates input beyond 72 bytes; reject longer passwords so a
# user is never surprised that only the first 72 bytes authenticate.
MAX_PASSWORD_BYTES = 72
MIN_PASSWORD_LENGTH = 8


def can_manage_templates(email: str, role: str) -> bool:
    configured_identity = settings.TEMPLATE_MANAGER_EMAIL.strip().lower()
    return bool(
        configured_identity
        and role == "teacher"
        and email.strip().lower() == configured_identity
    )


def validate_password(value: str) -> str:
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(
            f"비밀번호는 최소 {MIN_PASSWORD_LENGTH}자 이상이어야 합니다."
        )
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("비밀번호가 너무 깁니다. 72바이트 이하로 입력해 주세요.")
    return value


class UserInToken(BaseModel):
    """User data returned in login response."""

    id: UUID
    name: str
    email: str
    role: str

    @computed_field
    @property
    def can_manage_templates(self) -> bool:
        return can_manage_templates(self.email, self.role)

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    """Login request schema."""

    email: str
    password: str


class LoginResponse(BaseModel):
    """Login response. Auth tokens are delivered only through httpOnly cookies."""

    user: UserInToken


class RefreshRequest(BaseModel):
    """Refresh token request schema.

    The refresh token is read from the httpOnly cookie. The optional body field
    is accepted for old clients but is no longer returned by browser login.
    """

    refresh_token: str | None = None


class RefreshResponse(BaseModel):
    """Refresh token response. New tokens are set as httpOnly cookies."""

    ok: bool = True


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

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        return validate_password(value)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _check_new_password(cls, value: str) -> str:
        return validate_password(value)
