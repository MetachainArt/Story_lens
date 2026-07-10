"""Shared helpers for auth cookies."""

from fastapi import Response

from app.core.config import settings


def _use_secure_cookie() -> bool:
    return settings.ENVIRONMENT.lower() in {"prod", "production"}


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set the httpOnly auth cookies used by browser sessions."""
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,
        secure=_use_secure_cookie(),
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        secure=_use_secure_cookie(),
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
