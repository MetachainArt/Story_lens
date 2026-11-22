"""Authentication API integration tests."""

import pytest
from httpx import AsyncClient

from app.models.user import User


ALLOWED_ORIGIN = {"Origin": "http://localhost:5173"}


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_sets_http_only_cookies(
        self, client: AsyncClient, test_teacher: User
    ):
        response = await client.post(
            "/api/auth/login",
            json={"email": "teacher@storylens.com", "password": "password123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert set(data) == {"user"}
        assert "access_token" not in data
        assert "refresh_token" not in data
        assert data["user"]["name"] == "테스트 선생님"
        assert data["user"]["email"] == "teacher@storylens.com"
        assert data["user"]["role"] == "teacher"
        assert "password" not in data["user"]
        assert "password_hash" not in data["user"]

        set_cookie_headers = response.headers.get_list("set-cookie")
        assert any(
            header.startswith("access_token=") and "HttpOnly" in header
            for header in set_cookie_headers
        )
        assert any(
            header.startswith("refresh_token=") and "HttpOnly" in header
            for header in set_cookie_headers
        )

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("email", "password"),
        [
            ("teacher@storylens.com", "wrongpassword"),
            ("nonexistent@example.com", "password123"),
        ],
    )
    async def test_login_rejects_invalid_credentials(
        self,
        client: AsyncClient,
        test_teacher: User,
        email: str,
        password: str,
    ):
        response = await client.post(
            "/api/auth/login", json={"email": email, "password": password}
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "이메일 또는 비밀번호가 올바르지 않습니다."

    @pytest.mark.asyncio
    async def test_login_validates_request_shape(self, client: AsyncClient):
        invalid_email = await client.post(
            "/api/auth/login", json={"email": "not-an-email"}
        )
        missing_password = await client.post(
            "/api/auth/login", json={"email": "teacher@storylens.com"}
        )

        # LoginRequest intentionally accepts legacy non-email account names, but
        # a password is always required.
        assert invalid_email.status_code == 422
        assert missing_password.status_code == 422


class TestLogout:
    @pytest.mark.asyncio
    async def test_logout_clears_cookie_session(
        self, client: AsyncClient, test_teacher: User
    ):
        login_response = await client.post(
            "/api/auth/login",
            json={"email": "teacher@storylens.com", "password": "password123"},
        )
        assert login_response.status_code == 200

        response = await client.post("/api/auth/logout", headers=ALLOWED_ORIGIN)

        assert response.status_code == 200
        assert response.json() == {"message": "로그아웃 되었습니다."}
        cookie_headers = response.headers.get_list("set-cookie")
        assert any("access_token=" in header and "Max-Age=0" in header for header in cookie_headers)
        assert any("refresh_token=" in header and "Max-Age=0" in header for header in cookie_headers)

    @pytest.mark.asyncio
    async def test_logout_succeeds_without_a_session(self, client: AsyncClient):
        response = await client.post("/api/auth/logout")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_logout_succeeds_with_an_invalid_bearer_token(
        self, client: AsyncClient
    ):
        response = await client.post(
            "/api/auth/logout",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 200


class TestPasswordChange:
    @pytest.mark.asyncio
    async def test_password_change_revokes_other_sessions_and_keeps_this_one(
        self, client: AsyncClient, test_teacher: User
    ):
        credentials = {"email": "teacher@storylens.com", "password": "password123"}
        other_device = await client.post("/api/auth/login", json=credentials)
        assert other_device.status_code == 200
        other_access = other_device.cookies["access_token"]
        other_refresh = other_device.cookies["refresh_token"]

        # The client now holds session cookies, so later state-changing calls
        # must come from an allowed origin, exactly like a real browser.
        this_device = await client.post(
            "/api/auth/login", json=credentials, headers=ALLOWED_ORIGIN
        )
        assert this_device.status_code == 200

        change = await client.post(
            "/api/auth/password/change",
            headers=ALLOWED_ORIGIN,
            json={
                "current_password": "password123",
                "new_password": "new-password-456",
            },
        )
        assert change.status_code == 200

        # The browser that changed the password received fresh cookies.
        still_signed_in = await client.get("/api/v1/users/me")
        assert still_signed_in.status_code == 200

        # Sessions issued for the old password no longer work anywhere.
        client.cookies.clear()
        stale_access = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {other_access}"},
        )
        assert stale_access.status_code == 401

        stale_refresh = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": other_refresh},
        )
        assert stale_refresh.status_code == 401


class TestRefreshToken:
    @pytest.mark.asyncio
    async def test_refresh_rotates_cookie_tokens(
        self, client: AsyncClient, test_teacher: User
    ):
        login_response = await client.post(
            "/api/auth/login",
            json={"email": "teacher@storylens.com", "password": "password123"},
        )
        assert login_response.status_code == 200
        old_access = login_response.cookies["access_token"]
        old_refresh = login_response.cookies["refresh_token"]

        response = await client.post("/api/auth/refresh", headers=ALLOWED_ORIGIN)

        assert response.status_code == 200
        assert response.json() == {"ok": True}
        assert response.cookies["access_token"] != old_access
        assert response.cookies["refresh_token"] != old_refresh

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "token",
        [
            "invalid_token",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
            "eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNjE2MjM5MDIyfQ."
            "1234567890",
        ],
    )
    async def test_refresh_rejects_invalid_or_expired_token(
        self, client: AsyncClient, token: str
    ):
        response = await client.post(
            "/api/auth/refresh", json={"refresh_token": token}
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_rejects_access_token(
        self, client: AsyncClient, test_teacher: User
    ):
        login_response = await client.post(
            "/api/auth/login",
            json={"email": "teacher@storylens.com", "password": "password123"},
        )
        access_token = login_response.cookies["access_token"]
        client.cookies.clear()

        response = await client.post(
            "/api/auth/refresh", json={"refresh_token": access_token}
        )
        assert response.status_code == 401
