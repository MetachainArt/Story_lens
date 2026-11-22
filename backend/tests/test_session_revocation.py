"""Session lifecycle regressions that do not require a live PostgreSQL server.

Covers two shared-device risks: logout must always clear the browser session,
and a password change must invalidate sessions issued for the old password.
"""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    token_matches_password,
)
from app.main import app
from app.services.auth import verify_refresh_token

ALLOWED_ORIGIN = {"Origin": "http://localhost:5173"}
OLD_HASH = "$2b$12$old-password-hash-value"
NEW_HASH = "$2b$12$new-password-hash-value"


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class _SingleUserDb:
    def __init__(self, user: object) -> None:
        self.user = user

    async def execute(self, _statement: object) -> _ScalarResult:
        return _ScalarResult(self.user)


def _request(cookie: str | None = None) -> Request:
    headers = [(b"cookie", cookie.encode())] if cookie else []
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "https",
            "path": "/api/v1/users/me",
            "raw_path": b"/api/v1/users/me",
            "query_string": b"",
            "headers": headers,
            "client": ("127.0.0.1", 1234),
            "server": ("api.example.test", 443),
        }
    )


def _user(password_hash: str) -> SimpleNamespace:
    return SimpleNamespace(id=uuid4(), is_active=True, password_hash=password_hash)


def test_token_carries_password_fingerprint_without_exposing_the_hash() -> None:
    token = create_access_token(subject=uuid4(), password_hash=OLD_HASH)

    payload = decode_token(token)

    assert payload["pwd"]
    assert OLD_HASH not in token
    assert payload["pwd"] not in OLD_HASH
    assert token_matches_password(payload, OLD_HASH) is True
    assert token_matches_password(payload, NEW_HASH) is False


def test_tokens_issued_before_this_change_stay_valid_until_they_expire() -> None:
    legacy_payload = decode_token(create_access_token(subject=uuid4()))

    assert "pwd" not in legacy_payload
    assert token_matches_password(legacy_payload, NEW_HASH) is True


@pytest.mark.asyncio
async def test_access_token_is_rejected_after_password_change() -> None:
    user = _user(OLD_HASH)
    token = create_access_token(subject=user.id, password_hash=OLD_HASH)
    user.password_hash = NEW_HASH

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(
            _SingleUserDb(user), _request(f"access_token={token}"), token=None
        )

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_access_token_for_current_password_is_accepted() -> None:
    user = _user(OLD_HASH)
    token = create_access_token(subject=user.id, password_hash=OLD_HASH)

    authenticated = await get_current_user(
        _SingleUserDb(user), _request(f"access_token={token}"), token=None
    )

    assert authenticated is user


@pytest.mark.asyncio
async def test_refresh_token_is_rejected_after_password_change() -> None:
    user = _user(OLD_HASH)
    token = create_refresh_token(subject=user.id, password_hash=OLD_HASH)

    assert await verify_refresh_token(_SingleUserDb(user), token) is user

    user.password_hash = NEW_HASH

    assert await verify_refresh_token(_SingleUserDb(user), token) is None


def _cleared(cookie_headers: list[str], name: str) -> bool:
    return any(f"{name}=" in header and "Max-Age=0" in header for header in cookie_headers)


@pytest.mark.asyncio
async def test_logout_clears_cookies_when_the_access_token_has_expired() -> None:
    """A shared classroom device must be able to sign out with a stale session."""
    refresh_token = create_refresh_token(subject=uuid4())

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/auth/logout",
            headers={
                **ALLOWED_ORIGIN,
                "Cookie": f"access_token=expired-or-garbage; refresh_token={refresh_token}",
            },
        )

    assert response.status_code == 200
    cookie_headers = response.headers.get_list("set-cookie")
    assert _cleared(cookie_headers, "access_token")
    assert _cleared(cookie_headers, "refresh_token")


@pytest.mark.asyncio
async def test_logout_without_any_session_still_succeeds() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/auth/logout")

    assert response.status_code == 200
    assert _cleared(response.headers.get_list("set-cookie"), "refresh_token")


@pytest.mark.asyncio
async def test_logout_from_an_untrusted_site_cannot_end_the_session() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/auth/logout",
            headers={
                "Origin": "https://attacker.example",
                "Cookie": "access_token=anything",
            },
        )

    assert response.status_code == 403
