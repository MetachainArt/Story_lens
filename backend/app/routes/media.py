"""Private media delivery routes.

Uploads are intentionally not mounted as public static files. Images and local
audio are served through this route with either a logged-in access token or a
short-lived signed media token for provider callbacks/reference reads.
"""

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.auth_cookies import set_auth_cookies
from ..core.upload_paths import resolve_upload_path
from ..core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_media_token,
)
from ..db.session import get_db
from ..models.photo import Photo
from ..models.user import User
from ..services.auth import verify_refresh_token

router = APIRouter(prefix="/media", tags=["media"])

APP_ROOT = Path(__file__).resolve().parents[2]
UPLOAD_ROOT = (APP_ROOT / "uploads").resolve()
PRIVATE_MEDIA_HEADERS = {
    "Cache-Control": "private, no-store",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
}


def _private_file_response(resolved: Path, *, download: bool) -> FileResponse:
    return FileResponse(
        str(resolved),
        filename=resolved.name if download else None,
        headers=PRIVATE_MEDIA_HEADERS,
    )


def _resolve_upload_path(path: str) -> tuple[str, Path]:
    resolved = resolve_upload_path(APP_ROOT, path)
    if resolved is None or not resolved.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    return resolved.relative_to(APP_ROOT.resolve()).as_posix(), resolved


async def _user_from_access_token(db: AsyncSession, token: str) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type", "access") != "access":
            raise ValueError("Invalid token type")
        user_id = UUID(str(payload.get("sub")))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")
    return user


async def _user_from_refresh_token(
    db: AsyncSession,
    token: str | None,
) -> tuple[User, tuple[str, str]]:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")

    user = await verify_refresh_token(db, token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    return user, (access_token, refresh_token)


async def _user_from_browser_session(
    db: AsyncSession,
    request: Request,
) -> tuple[User, tuple[str, str] | None]:
    access_token = request.cookies.get("access_token")
    if access_token:
        try:
            return await _user_from_access_token(db, access_token), None
        except HTTPException as exc:
            if exc.status_code != status.HTTP_401_UNAUTHORIZED:
                raise

    return await _user_from_refresh_token(db, request.cookies.get("refresh_token"))


def _photo_owner_id(normalized_path: str) -> UUID | None:
    parts = Path(normalized_path).parts
    if len(parts) >= 4 and parts[0] == "uploads" and parts[1] == "photos":
        try:
            return UUID(parts[2])
        except ValueError:
            return None
    return None


def _music_photo_id(normalized_path: str) -> UUID | None:
    parts = Path(normalized_path).parts
    if len(parts) >= 4 and parts[0] == "uploads" and parts[1] == "music":
        try:
            return UUID(parts[2])
        except ValueError:
            return None
    return None


async def _media_owner_id(
    db: AsyncSession,
    normalized_path: str,
) -> UUID | None:
    owner_id = _photo_owner_id(normalized_path)
    if owner_id is not None:
        return owner_id

    photo_id = _music_photo_id(normalized_path)
    if photo_id is None:
        return None

    result = await db.execute(select(Photo.user_id).where(Photo.id == photo_id))
    return result.scalar_one_or_none()


async def _can_access_path(db: AsyncSession, user: User, normalized_path: str) -> bool:
    owner_id = await _media_owner_id(db, normalized_path)
    if owner_id is None:
        # Only known, ownership-scoped upload layouts are browser-readable.
        return False
    if owner_id == user.id:
        return True
    # A teacher may read media owned by a student they manage. No other
    # cross-user access (parents have no child link yet).
    if user.role == "teacher":
        result = await db.execute(
            select(User.id).where(
                User.id == owner_id,
                User.role == "student",
                User.teacher_id == user.id,
            )
        )
        return result.scalar_one_or_none() is not None
    return False


@router.get("/{path:path}")
async def get_private_media(
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token: str | None = Query(default=None),
    download: bool = Query(default=False),
):
    normalized_path, resolved = _resolve_upload_path(path)

    if token:
        try:
            if verify_media_token(token, normalized_path):
                return _private_file_response(resolved, download=download)
        except ValueError:
            pass

    user, refreshed_tokens = await _user_from_browser_session(db, request)
    if not await _can_access_path(db, user, normalized_path):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Media not found")

    response = _private_file_response(resolved, download=download)
    if refreshed_tokens:
        set_auth_cookies(response, refreshed_tokens[0], refreshed_tokens[1])
    return response
