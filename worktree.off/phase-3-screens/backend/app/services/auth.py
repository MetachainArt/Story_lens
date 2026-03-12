"""Authentication service."""
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.core.security import get_password_hash, verify_password, decode_token


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Get user by email."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    """Get user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    """Authenticate user with email and password."""
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


async def verify_refresh_token(db: AsyncSession, refresh_token: str) -> User | None:
    """Verify refresh token and return user."""
    try:
        payload = decode_token(refresh_token)
        user_id = payload.get("sub")
        token_type = payload.get("type")

        if token_type != "refresh":
            return None

        if not user_id:
            return None

        user = await get_user_by_id(db, UUID(user_id))
        if not user or not user.is_active:
            return None

        return user
    except (ValueError, Exception):
        return None


async def create_user(db: AsyncSession, user_in: RegisterRequest) -> User:
    """Create new user (teacher registration)."""
    user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role="teacher",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_password(db: AsyncSession, user: User, new_password: str) -> User:
    """Update user password."""
    user.password_hash = get_password_hash(new_password)
    await db.commit()
    await db.refresh(user)
    return user
