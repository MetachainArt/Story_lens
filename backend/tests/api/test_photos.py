# @TASK P2-R2-T1 - Photos API 테스트
# @SPEC docs/planning/05-api-design.md#photos-api
"""Tests for Photos API endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from io import BytesIO
from uuid import UUID, uuid4


@pytest.mark.asyncio
async def test_upload_photo(
    client: AsyncClient, db_session: AsyncSession, student_token: str, test_student
):
    """Test uploading a photo."""
    # Create a fake image file
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "Test Photo", "topic": "봄꽃"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Photo"
    assert data["topic"] == "봄꽃"
    assert data["user_id"] == str(test_student.id)
    assert "original_url" in data
    assert data["edited_url"] is None
    assert data["thumbnail_url"] is None


@pytest.mark.asyncio
async def test_upload_photo_with_session(
    client: AsyncClient, db_session: AsyncSession, student_token: str, test_student: str
):
    """Test uploading a photo with session_id."""
    # First create a session
    session_response = await client.post(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "date": str(date.today()),
            "location": "Test Location",
            "title": "Test Session",
        },
    )
    assert session_response.status_code == 201
    session_id = session_response.json()["id"]

    # Upload photo with session_id
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "Test Photo", "session_id": session_id},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["session_id"] == session_id


@pytest.mark.asyncio
async def test_get_photos_list(
    client: AsyncClient, db_session: AsyncSession, student_token: str
):
    """Test getting list of photos."""
    # Upload a photo first
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "Photo 1"},
    )

    # Get photos list
    response = await client.get(
        "/api/v1/photos", headers={"Authorization": f"Bearer {student_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["title"] == "Photo 1"


@pytest.mark.asyncio
async def test_get_photo_detail(
    client: AsyncClient, db_session: AsyncSession, student_token: str
):
    """Test getting a single photo detail."""
    # Upload a photo first
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    upload_response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "Detail Photo"},
    )
    photo_id = upload_response.json()["id"]

    # Get photo detail
    response = await client.get(
        f"/api/v1/photos/{photo_id}",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == photo_id
    assert data["title"] == "Detail Photo"


@pytest.mark.asyncio
async def test_get_photo_not_own(
    client: AsyncClient,
    db_session: AsyncSession,
    student_token: str,
    teacher_token: str,
):
    """Test accessing another user's photo returns 404."""
    # Upload a photo as regular user
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    upload_response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "Private Photo"},
    )
    photo_id = upload_response.json()["id"]

    # Try to access with different user (teacher)
    response = await client.get(
        f"/api/v1/photos/{photo_id}",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_photo(
    client: AsyncClient, db_session: AsyncSession, student_token: str
):
    """Test updating a photo."""
    # Upload a photo first
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    upload_response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "Original Title"},
    )
    photo_id = upload_response.json()["id"]

    # Update photo
    response = await client.put(
        f"/api/v1/photos/{photo_id}",
        headers={"Authorization": f"Bearer {student_token}"},
        json={
            "title": "Updated Title",
            "topic": "바다",
            "edited_url": "/uploads/photos/edited123.jpg",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["topic"] == "바다"
    assert data["edited_url"] == "/uploads/photos/edited123.jpg"


@pytest.mark.asyncio
async def test_update_photo_with_data_url(
    client: AsyncClient,
    db_session: AsyncSession,
    student_token: str,
    test_student,
):
    """Test updating a photo with data URL saves file and stores upload path."""
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    upload_response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "Original Title"},
    )
    photo_id = upload_response.json()["id"]

    data_url = "data:image/jpeg;base64,ZmFrZS1pbWFnZS1ieXRlcw=="
    response = await client.put(
        f"/api/v1/photos/{photo_id}",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"edited_url": data_url},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["edited_url"].startswith(f"/uploads/photos/{test_student.id}/")
    assert data["edited_url"].endswith(".jpg")


@pytest.mark.asyncio
async def test_delete_photo(
    client: AsyncClient, db_session: AsyncSession, student_token: str
):
    """Test deleting a photo."""
    # Upload a photo first
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    upload_response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "To Delete"},
    )
    photo_id = upload_response.json()["id"]

    # Delete photo
    response = await client.delete(
        f"/api/v1/photos/{photo_id}",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert response.status_code == 204

    # Verify it's deleted
    get_response = await client.get(
        f"/api/v1/photos/{photo_id}",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_ai_generated_photo_clears_generation_job_references(
    client: AsyncClient,
    db_session: AsyncSession,
    student_token: str,
    test_student,
):
    """AI-generated photos should not reappear because generation jobs keep FKs."""
    from app.models.ai_templates import Category, ImageGenerationJob, PromptTemplate

    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    upload_response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "AI To Delete"},
    )
    assert upload_response.status_code == 201
    photo_id = upload_response.json()["id"]
    photo_uuid = UUID(photo_id)

    category = Category(
        name="AI사진보정",
        slug=f"retouch-delete-test-{uuid4()}",
        kind="retouch",
        sort_order=1,
        is_active=True,
    )
    db_session.add(category)
    await db_session.flush()

    template = PromptTemplate(
        category_id=category.id,
        name="삭제 테스트 보정",
        description="삭제 테스트",
        base_prompt="delete test prompt",
        variables=[],
        default_values={},
        negative_terms=[],
        locale_labels={"kind": "retouch"},
        requires_source_photo=True,
        aspect_ratio="4:3",
        visible_user_fields=[],
        is_public=True,
        is_active=True,
        is_recommended=False,
        usage_count=0,
    )
    db_session.add(template)
    await db_session.flush()

    job = ImageGenerationJob(
        user_id=test_student.id,
        template_id=template.id,
        source_photo_id=photo_uuid,
        source_photo_ids=[photo_id],
        photo_id=photo_uuid,
        status="succeeded",
        provider="kie",
        provider_model="gpt-image-2-image-to-image",
        prompt="delete test prompt",
        variable_values={},
        provider_options={},
        result_url="/uploads/photos/result.jpg",
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    response = await client.delete(
        f"/api/v1/photos/{photo_id}",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert response.status_code == 204

    get_response = await client.get(
        f"/api/v1/photos/{photo_id}",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert get_response.status_code == 404

    await db_session.refresh(job)
    assert job.photo_id is None
    assert job.source_photo_id is None
    assert job.result_url is None


@pytest.mark.asyncio
async def test_photos_without_auth(client: AsyncClient):
    """Test accessing photos without authentication returns 401."""
    response = await client.get("/api/v1/photos")
    assert response.status_code == 401

    fake_photo_id = str(uuid4())
    response = await client.get(f"/api/v1/photos/{fake_photo_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_recommend_sentences_from_photo_topic(
    client: AsyncClient, student_token: str
):
    """Test generating sentence recommendations from photo topic."""
    image_data = b"fake-image-data"
    files = {"file": ("test.jpg", BytesIO(image_data), "image/jpeg")}

    upload_response = await client.post(
        "/api/v1/photos",
        headers={"Authorization": f"Bearer {student_token}"},
        files=files,
        data={"title": "Writing Photo", "topic": "용기"},
    )
    assert upload_response.status_code == 201
    photo_id = upload_response.json()["id"]

    recommend_response = await client.post(
        f"/api/v1/photos/{photo_id}/recommend-sentences",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"keywords": ["미소", "햇살"]},
    )

    assert recommend_response.status_code == 200
    data = recommend_response.json()
    assert data["topic"] == "용기"
    assert data["keywords"][0] == "미소"
    assert isinstance(data["recommendations"], list)
    assert len(data["recommendations"]) == 3


@pytest.mark.asyncio
async def test_recommend_sentences_requires_auth(client: AsyncClient):
    """Test sentence recommendation endpoint requires authentication."""
    fake_photo_id = str(uuid4())
    response = await client.post(
        f"/api/v1/photos/{fake_photo_id}/recommend-sentences",
        json={"keywords": ["봄"]},
    )
    assert response.status_code == 401
