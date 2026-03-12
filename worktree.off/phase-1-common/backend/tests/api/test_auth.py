"""Authentication API tests."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User


class TestLogin:
    """Test POST /api/auth/login endpoint."""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_teacher: User):
        """Test successful login with correct credentials."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "teacher@storylens.com",
                "password": "password123"
            }
        )

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data

        # Check tokens are not empty
        assert data["access_token"]
        assert data["refresh_token"]

        # Check user data
        user = data["user"]
        assert user["id"]
        assert user["name"] == "테스트 선생님"
        assert user["email"] == "teacher@storylens.com"
        assert user["role"] == "teacher"

        # Ensure password is not in response
        assert "password" not in user
        assert "password_hash" not in user

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_teacher: User):
        """Test login fails with incorrect password."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "teacher@storylens.com",
                "password": "wrongpassword"
            }
        )

        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "이메일 또는 비밀번호가 올바르지 않습니다"

    @pytest.mark.asyncio
    async def test_login_nonexistent_email(self, client: AsyncClient):
        """Test login fails with non-existent email."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123"
            }
        )

        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "이메일 또는 비밀번호가 올바르지 않습니다"

    @pytest.mark.asyncio
    async def test_login_invalid_email_format(self, client: AsyncClient):
        """Test login with invalid email format."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "not-an-email",
                "password": "password123"
            }
        )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_login_missing_password(self, client: AsyncClient):
        """Test login with missing password field."""
        response = await client.post(
            "/api/auth/login",
            json={
                "email": "teacher@storylens.com"
            }
        )

        assert response.status_code == 422  # Validation error


class TestLogout:
    """Test POST /api/auth/logout endpoint."""

    @pytest.mark.asyncio
    async def test_logout_success(self, client: AsyncClient, test_teacher: User):
        """Test successful logout with valid token."""
        # First login to get token
        login_response = await client.post(
            "/api/auth/login",
            json={
                "email": "teacher@storylens.com",
                "password": "password123"
            }
        )
        assert login_response.status_code == 200
        access_token = login_response.json()["access_token"]

        # Then logout
        response = await client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "로그아웃 되었습니다"

    @pytest.mark.asyncio
    async def test_logout_without_token(self, client: AsyncClient):
        """Test logout fails without authentication token."""
        response = await client.post("/api/auth/logout")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_logout_with_invalid_token(self, client: AsyncClient):
        """Test logout fails with invalid token."""
        response = await client.post(
            "/api/auth/logout",
            headers={"Authorization": "Bearer invalid_token"}
        )

        assert response.status_code == 401


class TestRefreshToken:
    """Test POST /api/auth/refresh endpoint."""

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client: AsyncClient, test_teacher: User):
        """Test successful token refresh with valid refresh token."""
        # First login to get refresh token
        login_response = await client.post(
            "/api/auth/login",
            json={
                "email": "teacher@storylens.com",
                "password": "password123"
            }
        )
        assert login_response.status_code == 200
        old_refresh_token = login_response.json()["refresh_token"]
        old_access_token = login_response.json()["access_token"]

        # Wait briefly so new tokens have different timestamps
        import asyncio
        await asyncio.sleep(1)

        # Refresh tokens
        response = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": old_refresh_token}
        )

        assert response.status_code == 200
        data = response.json()

        # Check new tokens are returned
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"]
        assert data["refresh_token"]

        # New tokens should be different from old ones
        assert data["access_token"] != old_access_token
        assert data["refresh_token"] != old_refresh_token

    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, client: AsyncClient):
        """Test token refresh fails with invalid refresh token."""
        response = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": "invalid_token"}
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_expired(self, client: AsyncClient):
        """Test token refresh fails with expired token.

        Note: This test uses a manually expired token.
        In production, you'd generate a token with past expiry.
        """
        # This is a placeholder - in real scenario, we'd generate an expired token
        expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNjE2MjM5MDIyfQ.1234567890"

        response = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": expired_token}
        )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_should_fail(self, client: AsyncClient, test_teacher: User):
        """Test that using access token for refresh should fail."""
        # Login to get access token
        login_response = await client.post(
            "/api/auth/login",
            json={
                "email": "teacher@storylens.com",
                "password": "password123"
            }
        )
        access_token = login_response.json()["access_token"]

        # Try to refresh using access token (should fail)
        response = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": access_token}
        )

        assert response.status_code == 401
