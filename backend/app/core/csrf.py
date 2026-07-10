"""CSRF protection for browser requests authenticated by cookies."""

from __future__ import annotations

from collections.abc import Iterable
from urllib.parse import urlparse

from starlette.datastructures import Headers
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
AUTH_ENTRY_PATHS = frozenset(
    {
        "/api/auth/login",
        "/api/auth/login/form",
        "/api/auth/register",
    }
)


def canonical_origin(value: str | None) -> str | None:
    """Return a normalized HTTP(S) origin, or ``None`` for invalid input."""
    if not value or value == "null":
        return None

    parsed = urlparse(value.strip())
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        return None

    scheme = parsed.scheme.lower()
    hostname = parsed.hostname.lower()
    if ":" in hostname and not hostname.startswith("["):
        hostname = f"[{hostname}]"

    port = parsed.port
    default_port = (scheme == "http" and port == 80) or (
        scheme == "https" and port == 443
    )
    authority = hostname if port is None or default_port else f"{hostname}:{port}"
    return f"{scheme}://{authority}"


def request_origin(headers: Headers) -> str | None:
    """Read the browser source from Origin, falling back to Referer."""
    origin = canonical_origin(headers.get("origin"))
    if origin:
        return origin
    return canonical_origin(headers.get("referer"))


class CSRFMiddleware:
    """Reject cross-site state changes that can carry auth cookies.

    Browser cookie sessions must come from an explicitly allowed frontend
    origin. Bearer-token API clients are not vulnerable to browser CSRF and are
    therefore left unchanged. Login/register requests with an Origin header are
    checked as well to prevent login CSRF, while non-browser maintenance clients
    without cookies remain usable.
    """

    def __init__(self, app: ASGIApp, allowed_origins: Iterable[str]) -> None:
        self.app = app
        self.allowed_origins = {
            origin
            for item in allowed_origins
            if (origin := canonical_origin(item)) is not None
        }

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"].upper() not in UNSAFE_METHODS:
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        authorization = request.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            await self.app(scope, receive, send)
            return

        has_auth_cookie = bool(
            request.cookies.get("access_token")
            or request.cookies.get("refresh_token")
        )
        has_browser_source = bool(
            request.headers.get("origin") or request.headers.get("referer")
        )
        check_login_source = scope.get("path") in AUTH_ENTRY_PATHS and has_browser_source

        if has_auth_cookie or check_login_source:
            origin = request_origin(request.headers)
            if origin not in self.allowed_origins:
                response = JSONResponse(
                    status_code=403,
                    content={
                        "detail": "안전하지 않은 요청으로 확인되어 처리하지 않았어요. 페이지를 새로고침한 뒤 다시 시도해 주세요."
                    },
                )
                await response(scope, receive, send)
                return

        await self.app(scope, receive, send)
