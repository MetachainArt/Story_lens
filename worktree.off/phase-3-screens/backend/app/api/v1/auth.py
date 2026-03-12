"""Authentication endpoints."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.auth import (
    Token,
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    LogoutResponse,
    UserInToken,
    RegisterRequest,
    PasswordChangeRequest
)
from app.schemas.user import UserResponse
from app.services.auth import (
    authenticate_user,
    verify_refresh_token,
    create_user,
    get_user_by_email,
    update_password
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password
)
from app.core.deps import CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Login with email and password.

    Returns access token, refresh token, and user information.
    """
    user = await authenticate_user(db, login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )

    # Create tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    # Prepare user data
    user_data = UserInToken(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_data
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(current_user: CurrentUser):
    """Logout current user.

    Note: For stateless JWT, this endpoint just returns success.
    Client should discard tokens.
    """
    return LogoutResponse(message="로그아웃 되었습니다")


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_tokens(
    refresh_data: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Refresh access token using refresh token.

    Returns new access token and refresh token.
    """
    user = await verify_refresh_token(db, refresh_data.refresh_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Create new tokens
    new_access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)

    return RefreshResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token
    )


# Legacy endpoints for compatibility
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a new user."""
    existing_user = await get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    user = await create_user(db, user_in)
    return user


@router.post("/login/form", response_model=Token)
async def login_form(
    db: Annotated[AsyncSession, Depends(get_db)],
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    """Login with form data (OAuth2 compatible)."""
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
            detail="Incorrect current password"
        )

    await update_password(db, current_user, password_data.new_password)
    return {"message": "Password changed successfully"}
