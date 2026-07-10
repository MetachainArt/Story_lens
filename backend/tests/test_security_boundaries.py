"""Security regression tests that do not require a live PostgreSQL server."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from app.core.csrf import CSRFMiddleware, canonical_origin
from app.core.rate_limit import _bucket_key, rate_limit
from app.core.security import create_refresh_token
from app.db.session import get_db
from app.main import app
from app.routes.media import _can_access_path


def _request(
    path: str,
    *,
    headers: list[tuple[bytes, bytes]] | None = None,
) -> Request:
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "https",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": headers or [],
            "client": ("127.0.0.1", 1234),
            "server": ("api.example.test", 443),
        }
    )


def _csrf_test_app() -> FastAPI:
    csrf_app = FastAPI()
    csrf_app.add_middleware(
        CSRFMiddleware,
        allowed_origins=["https://storylens.example.test"],
    )

    @csrf_app.post("/unsafe")
    @csrf_app.post("/api/auth/login")
    async def unsafe_action() -> dict[str, bool]:
        return {"ok": True}

    return csrf_app


def test_canonical_origin_normalizes_default_port_and_path() -> None:
    assert canonical_origin("HTTPS://StoryLens.Example.Test:443/path") == (
        "https://storylens.example.test"
    )
    assert canonical_origin("null") is None


@pytest.mark.asyncio
async def test_csrf_rejects_untrusted_cookie_request() -> None:
    csrf_app = _csrf_test_app()
    async with AsyncClient(
        transport=ASGITransport(app=csrf_app),
        base_url="https://api.example.test",
        cookies={"access_token": "cookie-token"},
    ) as client:
        response = await client.post(
            "/unsafe",
            headers={"Origin": "https://attacker.example"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_csrf_accepts_allowed_cookie_request() -> None:
    csrf_app = _csrf_test_app()
    async with AsyncClient(
        transport=ASGITransport(app=csrf_app),
        base_url="https://api.example.test",
        cookies={"access_token": "cookie-token"},
    ) as client:
        response = await client.post(
            "/unsafe",
            headers={"Origin": "https://storylens.example.test"},
        )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_csrf_checks_browser_login_origin_without_cookie() -> None:
    csrf_app = _csrf_test_app()
    async with AsyncClient(
        transport=ASGITransport(app=csrf_app),
        base_url="https://api.example.test",
    ) as client:
        response = await client.post(
            "/api/auth/login",
            headers={"Origin": "https://attacker.example"},
        )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_cors_preflight_allows_patch() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        response = await client.options(
            "/api/v1/users/me",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "PATCH",
            },
        )

    assert response.status_code == 200
    assert "PATCH" in response.headers["access-control-allow-methods"]


def test_rate_limit_scope_is_shared_across_paths_for_same_user() -> None:
    token = create_refresh_token(subject=uuid4())
    cookie_header = [(b"cookie", f"refresh_token={token}".encode())]

    first = _bucket_key(
        _request("/api/auth/login", headers=cookie_header),
        60,
        "auth",
    )
    second = _bucket_key(
        _request("/api/auth/login/form", headers=cookie_header),
        60,
        "auth",
    )

    assert first == second


def test_login_account_buckets_are_separate_on_a_shared_ip() -> None:
    request = _request("/api/auth/login")

    first = _bucket_key(
        request,
        900,
        "auth-login-account",
        "first@example.com",
    )
    second = _bucket_key(
        request,
        900,
        "auth-login-account",
        "second@example.com",
    )
    same_account_case_variant = _bucket_key(
        request,
        900,
        "auth-login-account",
        " FIRST@example.com ",
    )

    assert first != second
    assert first == same_account_case_variant


def test_rate_limit_rejects_invalid_configuration() -> None:
    with pytest.raises(ValueError):
        rate_limit(0, 60)
    with pytest.raises(ValueError):
        rate_limit(1, 0)


@pytest.mark.asyncio
async def test_stt_rejects_unauthenticated_request_before_rate_limit_db() -> None:
    class NoDatabaseAccess:
        async def execute(self, *args: object, **kwargs: object) -> None:
            raise AssertionError("rate-limit DB must not run before authentication")

    async def override_get_db():
        yield NoDatabaseAccess()

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.post(
                "/api/v1/stt",
                files={"file": ("voice.webm", b"audio-bytes", "audio/webm")},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class _ResultSequenceDb:
    def __init__(self, *values: object) -> None:
        self.values = list(values)

    async def execute(self, _statement: object) -> _ScalarResult:
        if not self.values:
            raise AssertionError("Unexpected database query")
        return _ScalarResult(self.values.pop(0))


@pytest.mark.asyncio
async def test_music_media_is_scoped_to_its_photo_owner() -> None:
    owner_id = uuid4()
    other_user = SimpleNamespace(id=uuid4(), role="student")
    path = f"uploads/music/{uuid4()}/track.mp3"

    assert not await _can_access_path(_ResultSequenceDb(owner_id), other_user, path)


@pytest.mark.asyncio
async def test_teacher_can_read_managed_students_music() -> None:
    teacher_id = uuid4()
    student_id = uuid4()
    teacher = SimpleNamespace(id=teacher_id, role="teacher")
    path = f"uploads/music/{uuid4()}/track.mp3"

    assert await _can_access_path(
        _ResultSequenceDb(student_id, student_id),
        teacher,
        path,
    )


@pytest.mark.asyncio
async def test_unknown_upload_layout_is_not_shared_between_users() -> None:
    user = SimpleNamespace(id=uuid4(), role="student")

    assert not await _can_access_path(
        _ResultSequenceDb(),
        user,
        "uploads/misc/private.bin",
    )
