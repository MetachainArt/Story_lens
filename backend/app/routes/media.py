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

from ..core.security import decode_token, verify_media_token
from ..db.session import get_db
from ..models.user import User

router = APIRouter(prefix="/media", tags=["media"])

APP_ROOT = Path(__file__).resolve().parents[1]
UPLOAD_ROOT = (APP_ROOT / "uploads").resolve()


def _resolve_upload_path(path: str) -> tuple[str, Path]:
    normalized = path.strip().lstrip("/")
    if not normalized.startswith("uploads/"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    resolved = (APP_ROOT / normalized).resolve()
    try:
        resolved.relative_to(UPLOAD_ROOT)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    if not resolved.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")

    return normalized, resolved


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


def _photo_owner_id(normalized_path: str) -> UUID | None:
    parts = Path(normalized_path).parts
    if len(parts) >= 4 and parts[0] == "uploads" and parts[1] == "photos":
        try:
            return UUID(parts[2])
        except ValueError:
            return None
    return None


def _can_access_path(user: User, normalized_path: str) -> bool:
    owner_id = _photo_owner_id(normalized_path)
    if owner_id is None:
        return user.role in {"teacher", "parent", "student"}
    if owner_id == user.id:
        return True
    return user.role in {"teacher", "parent"}


@router.get("/{path:path}")
async def get_private_media(
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Query(default=None),
    token: str | None = Query(default=None),
):
    normalized_path, resolved = _resolve_upload_path(path)

    if token:
        try:
            if verify_media_token(token, normalized_path):
                return FileResponse(str(resolved))
        except ValueError:
            pass

    access_token = access_token or request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")

    user = await _user_from_access_token(db, access_token)
    if not _can_access_path(user, normalized_path):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Media not found")

    return FileResponse(str(resolved))
