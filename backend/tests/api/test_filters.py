"""Tests for Filters API endpoints.

@TASK P2-R3-T1 - Filters API
RED phase: Write tests that should fail
"""
import pytest
from httpx import AsyncClient
from app.models.user import User


class TestGetFilters:
    """Test GET /api/filters endpoint."""

    @pytest.mark.asyncio
    async def test_get_filters_list(
        self, client: AsyncClient, test_student: User, student_token: str
    ):
        """Should return list of 5 filters."""
        response = await client.get(
            "/api/filters",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 5

    @pytest.mark.asyncio
    async def test_filter_has_required_fields(
        self, client: AsyncClient, test_student: User, student_token: str
    ):
        """Each filter should have required fields."""
        response = await client.get(
            "/api/filters",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200
        data = response.json()

        # Check first filter has all required fields
        filter_item = data[0]
        assert "id" in filter_item
        assert "name" in filter_item
        assert "label" in filter_item
        assert "css_filter" in filter_item
        assert "preview_url" in filter_item

        # Validate specific filters
        filter_names = [f["name"] for f in data]
        assert "warm" in filter_names
        assert "cool" in filter_names
        assert "happy" in filter_names
        assert "calm" in filter_names
        assert "memory" in filter_names

    @pytest.mark.asyncio
    async def test_filter_css_values(
        self, client: AsyncClient, test_student: User, student_token: str
    ):
        """Filters should have correct CSS filter values."""
        response = await client.get(
            "/api/filters",
            headers={"Authorization": f"Bearer {student_token}"}
        )
        assert response.status_code == 200
        data = response.json()

        # Create mapping for validation
        filters_map = {f["name"]: f for f in data}

        # Check warm filter
        assert "brightness(1.1)" in filters_map["warm"]["css_filter"]
        assert "saturate(1.3)" in filters_map["warm"]["css_filter"]
        assert filters_map["warm"]["label"] == "따뜻한"

        # Check happy filter
        assert "brightness(1.2)" in filters_map["happy"]["css_filter"]
        assert filters_map["happy"]["label"] == "행복한"

    @pytest.mark.asyncio
    async def test_filters_without_auth(self, client: AsyncClient):
        """Unauthenticated request should return 401."""
        response = await client.get("/api/filters")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_filters_as_teacher(
        self, client: AsyncClient, test_teacher: User, teacher_token: str
    ):
        """Teachers should also access filters (for testing)."""
        response = await client.get(
            "/api/filters",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
