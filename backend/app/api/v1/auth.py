"""Authentication endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_cookies import clear_auth_cookies, set_auth_cookies
from app.core.config import settings
from app.core.deps import CurrentUser
from app.core.rate_limit import enforce_rate_limit, rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.db.session import get_db
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    PasswordChangeRequest,
    RefreshRequest,
    RefreshResponse,
    Token,
    UserInToken,
    RegisterRequest,
)
from app.schemas.user import UserResponse
from app.services.auth import (
    authenticate_user,
    create_user,
    get_user_by_email,
    update_password,
    verify_refresh_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _enforce_login_limits(
    db: AsyncSession,
    request: Request,
    identity: str,
) -> None:
    window = settings.AUTH_LOGIN_WINDOW_SECONDS
    await enforce_rate_limit(
        db,
        request,
        settings.AUTH_LOGIN_IP_MAX_ATTEMPTS,
        window,
        scope="auth-login-ip",
    )
    await enforce_rate_limit(
        db,
        request,
        settings.AUTH_LOGIN_MAX_ATTEMPTS,
        window,
        scope="auth-login-account",
        identity=identity,
    )


@router.post(
    "/login",
    response_model=LoginResponse,
)
async def login(
    login_data: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Login with email and password.

    Auth tokens are set as httpOnly cookies. The JSON response only returns the
    user so frontend JavaScript never receives raw tokens.
    """
    await _enforce_login_limits(db, request, login_data.email)
    user = await authenticate_user(db, login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
        )

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    set_auth_cookies(response, access_token, refresh_token)

    return LoginResponse(
        user=UserInToken(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
        )
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(response: Response, current_user: CurrentUser):
    """Logout current user."""
    _ = current_user
    clear_auth_cookies(response)
    return LogoutResponse(message="로그아웃 되었습니다.")


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    dependencies=[
        Depends(
            rate_limit(
                settings.AUTH_REFRESH_MAX_ATTEMPTS,
                settings.AUTH_REFRESH_WINDOW_SECONDS,
                scope="auth-refresh",
            )
        )
    ],
)
async def refresh_tokens(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_data: RefreshRequest | None = None,
):
    """Refresh access token using the httpOnly refresh cookie."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token and refresh_data:
        refresh_token = refresh_data.refresh_token
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 만료되었습니다. 다시 로그인해 주세요.",
        )

    user = await verify_refresh_token(db, refresh_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 만료되었습니다. 다시 로그인해 주세요.",
        )

    new_access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)
    set_auth_cookies(response, new_access_token, new_refresh_token)

    return RefreshResponse(ok=True)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(
            rate_limit(
                settings.AUTH_REGISTER_MAX_ATTEMPTS,
                settings.AUTH_REGISTER_WINDOW_SECONDS,
                scope="auth-register",
            )
        )
    ],
)
async def register(
    user_in: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new teacher account.

    Disabled by default: public self-registration as a teacher would grant the
    caller access to managed students' data. Enable only in trusted setups via
    ALLOW_TEACHER_REGISTRATION.
    """
    if not settings.ALLOW_TEACHER_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="회원가입은 관리자에게 요청해 주세요.",
        )

    existing_user = await get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다.",
        )

    user = await create_user(db, user_in)
    return user


@router.post(
    "/login/form",
    response_model=Token,
)
async def login_form(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    """Login with form data (OAuth2 compatible)."""
    await _enforce_login_limits(db, request, form_data.username)
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.id)
    return Token(access_token=access_token)


@router.post("/password/change")
async def change_password(
    password_data: PasswordChangeRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Change current user's password."""
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="현재 비밀번호가 올바르지 않습니다.",
        )

    await update_password(db, current_user, password_data.new_password)
    return {"message": "비밀번호가 변경되었습니다."}
