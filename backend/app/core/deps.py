"""Dependencies for authentication."""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import ALGORITHM
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    request: Request,
    token: Annotated[str | None, Depends(oauth2_scheme)] = None,
) -> User:
    """Get current authenticated user from JWT token or httpOnly cookie."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="로그인이 필요합니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = None
    cookie_token = request.cookies.get("access_token")
    candidates = [candidate for candidate in (token, cookie_token) if candidate]
    for candidate in dict.fromkeys(candidates):
        try:
            payload = jwt.decode(candidate, settings.SECRET_KEY, algorithms=[ALGORITHM])
            user_id: str | None = payload.get("sub")
            if user_id is None or payload.get("type", "access") != "access":
                continue
            token_data = TokenPayload(sub=user_id)
            break
        except jwt.InvalidTokenError:
            # A tab opened before the cookie migration can keep sending an
            # expired bearer token. Fall back to its refreshed cookie session.
            continue

    if token_data is None:
        raise credentials_exception

    try:
        user_uuid = UUID(token_data.sub)
    except (ValueError, AttributeError):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다.",
        )

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_teacher(current_user: CurrentUser) -> User:
    """Require current user to be a teacher."""
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="교사 계정만 사용할 수 있습니다.",
        )
    return current_user


RequireTeacher = Annotated[User, Depends(require_teacher)]


async def require_template_manager(current_user: RequireTeacher) -> User:
    """Require the dedicated account allowed to manage prompt templates."""
    allowed_email = settings.TEMPLATE_MANAGER_EMAIL.strip().lower()
    if not allowed_email or current_user.email.strip().lower() != allowed_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="프롬프트 템플릿을 관리할 권한이 없습니다.",
        )
    return current_user


RequireTemplateManager = Annotated[User, Depends(require_template_manager)]
