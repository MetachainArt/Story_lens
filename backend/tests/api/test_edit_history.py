# @TASK P2-R4-T1 - EditHistory API 테스트
# @SPEC docs/planning/05-api-design.md#edit-history-api
"""Tests for EditHistory API endpoints."""
import pytest
from httpx import AsyncClient
from app.models.user import User
from app.models.photo import Photo


@pytest.mark.asyncio
async def test_create_edit_history(
    client: AsyncClient,
    test_photo: Photo,
    student_token: str
):
    """Test creating a new edit history entry."""
    edit_data = {
        "filter_name": "vintage",
        "adjustments": {
            "brightness": 30,
            "saturation": -10,
            "contrast": 20
        },
        "crop_data": None
    }

    response = await client.post(
        f"/api/photos/{test_photo.id}/edits",
        json=edit_data,
        headers={"Authorization": f"Bearer {student_token}"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["photo_id"] == str(test_photo.id)
    assert data["filter_name"] == "vintage"
    assert data["adjustments"]["brightness"] == 30
    assert data["crop_data"] is None
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_edit_with_all_fields(
    client: AsyncClient,
    test_photo: Photo,
    student_token: str
):
    """Test creating edit history with filter, adjustments, and crop data."""
    edit_data = {
        "filter_name": "sepia",
        "adjustments": {
            "brightness": 30,
            "saturation": -10,
            "contrast": 20,
            "temperature": 0,
            "sharpness": 15
        },
        "crop_data": {
            "x": 10,
            "y": 20,
            "width": 300,
            "height": 300,
            "rotation": 90,
            "flip_h": False,
            "flip_v": False
        }
    }

    response = await client.post(
        f"/api/photos/{test_photo.id}/edits",
        json=edit_data,
        headers={"Authorization": f"Bearer {student_token}"}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["filter_name"] == "sepia"
    assert data["adjustments"]["sharpness"] == 15
    assert data["crop_data"]["rotation"] == 90
    assert data["crop_data"]["flip_h"] is False


@pytest.mark.asyncio
async def test_get_edit_history_list(
    client: AsyncClient,
    test_photo: Photo,
    student_token: str
):
    """Test retrieving edit history list for a photo."""
    # Create multiple edit history entries
    edits = [
        {
            "filter_name": "vintage",
            "adjustments": {"brightness": 30},
            "crop_data": None
        },
        {
            "filter_name": "sepia",
            "adjustments": {"saturation": -10},
            "crop_data": None
        },
        {
            "filter_name": None,
            "adjustments": None,
            "crop_data": {"x": 10, "y": 20, "width": 300, "height": 300}
        }
    ]

    for edit in edits:
        await client.post(
            f"/api/photos/{test_photo.id}/edits",
            json=edit,
            headers={"Authorization": f"Bearer {student_token}"}
        )

    # Get edit history list
    response = await client.get(
        f"/api/photos/{test_photo.id}/edits",
        headers={"Authorization": f"Bearer {student_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 3
    # Should be in descending order (latest first)
    assert data[0]["filter_name"] is None  # Last created
    assert data[1]["filter_name"] == "sepia"
    assert data[2]["filter_name"] == "vintage"  # First created


@pytest.mark.asyncio
async def test_edit_history_only_own_photo(
    client: AsyncClient,
    test_photo: Photo,
    test_teacher: User,
    teacher_token: str
):
    """Test that users can only access edit history of their own photos."""
    # Teacher tries to access student's photo edit history
    response = await client.get(
        f"/api/photos/{test_photo.id}/edits",
        headers={"Authorization": f"Bearer {teacher_token}"}
    )

    assert response.status_code == 403
    assert "own photos" in response.json()["detail"].lower()

    # Teacher tries to create edit for student's photo
    edit_data = {
        "filter_name": "vintage",
        "adjustments": None,
        "crop_data": None
    }
    response = await client.post(
        f"/api/photos/{test_photo.id}/edits",
        json=edit_data,
        headers={"Authorization": f"Bearer {teacher_token}"}
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_edit_history_without_auth(
    client: AsyncClient,
    test_photo: Photo
):
    """Test that unauthenticated requests are rejected."""
    # GET without auth
    response = await client.get(f"/api/photos/{test_photo.id}/edits")
    assert response.status_code == 401

    # POST without auth
    edit_data = {
        "filter_name": "vintage",
        "adjustments": None,
        "crop_data": None
    }
    response = await client.post(
        f"/api/photos/{test_photo.id}/edits",
        json=edit_data
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_edit_history_photo_not_found(
    client: AsyncClient,
    student_token: str
):
    """Test accessing edit history for non-existent photo."""
    fake_photo_id = "00000000-0000-0000-0000-000000000000"

    response = await client.get(
        f"/api/photos/{fake_photo_id}/edits",
        headers={"Authorization": f"Bearer {student_token}"}
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
