"""Tests for Users API endpoints.

@TASK P1-R2-T1 - Users API
RED phase: Write tests that should fail
"""
import pytest
from httpx import AsyncClient
from app.models.user import User


class TestGetMe:
    """Test GET /api/v1/users/me endpoint."""

    @pytest.mark.asyncio
    async def test_get_me_as_teacher(
        self, client: AsyncClient, test_teacher: User, teacher_token: str
    ):
        """Teacher should get their own profile."""
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_teacher.id)
        assert data["name"] == test_teacher.name
        assert data["email"] == test_teacher.email
        assert data["role"] == "teacher"
        assert data["teacher_id"] is None
        assert "password_hash" not in data

    @pytest.mark.asyncio
    async def test_get_me_as_student(
        self, client: AsyncClient, test_student: User, student_token: str, test_teacher: User
    ):
        """Student should get their own profile."""
        response = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_student.id)
        assert data["name"] == test_student.name
        assert data["email"] == test_student.email
        assert data["role"] == "student"
        assert data["teacher_id"] == str(test_teacher.id)
        assert "password_hash" not in data

    @pytest.mark.asyncio
    async def test_get_me_without_auth(self, client: AsyncClient):
        """Unauthenticated request should return 401."""
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401


class TestCreateStudent:
    """Test POST /api/v1/users endpoint."""

    @pytest.mark.asyncio
    async def test_create_student_as_teacher(
        self, client: AsyncClient, test_teacher: User, teacher_token: str
    ):
        """Teacher should be able to create student accounts."""
        response = await client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "name": "New Student",
                "email": "newstudent@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Student"
        assert data["email"] == "newstudent@test.com"
        assert data["role"] == "student"
        assert data["teacher_id"] == str(test_teacher.id)
        assert "password" not in data
        assert "password_hash" not in data

    @pytest.mark.asyncio
    async def test_create_student_as_student_forbidden(
        self, client: AsyncClient, test_student: User, student_token: str
    ):
        """Student should not be able to create accounts."""
        response = await client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {student_token}"},
            json={
                "name": "Another Student",
                "email": "another@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_create_student_duplicate_email(
        self, client: AsyncClient, test_teacher: User, teacher_token: str, test_student: User
    ):
        """Creating student with existing email should return 409."""
        response = await client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={
                "name": "Duplicate",
                "email": test_student.email,
                "password": "password123"
            }
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_create_student_without_auth(self, client: AsyncClient):
        """Unauthenticated request should return 401."""
        response = await client.post(
            "/api/v1/users",
            json={
                "name": "Test",
                "email": "test@test.com",
                "password": "password123"
            }
        )
        assert response.status_code == 401


class TestListStudents:
    """Test GET /api/v1/users endpoint."""

    @pytest.mark.asyncio
    async def test_list_students_as_teacher(
        self, client: AsyncClient, test_teacher: User, teacher_token: str, test_student: User
    ):
        """Teacher should see only their students."""
        response = await client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["id"] == str(test_student.id)
        assert data[0]["name"] == test_student.name
        assert data[0]["role"] == "student"

    @pytest.mark.asyncio
    async def test_list_students_as_student_forbidden(
        self, client: AsyncClient, test_student: User, student_token: str
    ):
        """Student should not be able to list users."""
        response = await client.get(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_list_students_without_auth(self, client: AsyncClient):
        """Unauthenticated request should return 401."""
        response = await client.get("/api/v1/users")
        assert response.status_code == 401
