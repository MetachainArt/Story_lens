"""Tests for Sessions API endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_session(
    client: AsyncClient,
    teacher_token: str,
    test_teacher,
):
    """Test creating a new session."""
    session_data = {
        "title": "봄나들이 촬영",
        "location": "서울숲",
        "date": "2024-03-15",
        "keywords": ["봄꽃", "산책", "햇살"],
    }

    response = await client.post(
        "/api/v1/sessions",
        json=session_data,
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "봄나들이 촬영"
    assert data["location"] == "서울숲"
    assert data["date"] == "2024-03-15"
    assert data["keywords"] == ["봄꽃", "산책", "햇살"]
    assert data["user_id"] == str(test_teacher.id)
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_session_without_auth(client: AsyncClient):
    """Test creating session without authentication returns 401."""
    session_data = {
        "title": "봄나들이 촬영",
        "location": "서울숲",
        "date": "2024-03-15",
    }

    response = await client.post("/api/v1/sessions", json=session_data)

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_sessions(
    client: AsyncClient,
    teacher_token: str,
    test_teacher,
):
    """Test listing all sessions for current user."""
    # Create two sessions
    session1 = {
        "title": "봄나들이 촬영",
        "location": "서울숲",
        "date": "2024-03-15",
        "keywords": ["봄"],
    }
    session2 = {
        "title": "여름 바다 촬영",
        "location": "부산 해운대",
        "date": "2024-07-20",
        "keywords": ["여름", "바다"],
    }

    await client.post(
        "/api/v1/sessions",
        json=session1,
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    await client.post(
        "/api/v1/sessions",
        json=session2,
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    # List sessions
    response = await client.get(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["title"] in ["봄나들이 촬영", "여름 바다 촬영"]
    assert data[1]["title"] in ["봄나들이 촬영", "여름 바다 촬영"]


@pytest.mark.asyncio
async def test_list_sessions_only_own(
    client: AsyncClient,
    teacher_token: str,
    student_token: str,
    test_teacher,
    test_student,
):
    """Test that users only see their own sessions."""
    # Teacher creates a session
    teacher_session = {
        "title": "선생님 촬영",
        "location": "경복궁",
        "date": "2024-04-10",
        "keywords": ["선생님"],
    }
    await client.post(
        "/api/v1/sessions",
        json=teacher_session,
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    # Student creates a session
    student_session = {
        "title": "학생 촬영",
        "location": "남산타워",
        "date": "2024-05-05",
        "keywords": ["학생"],
    }
    await client.post(
        "/api/v1/sessions",
        json=student_session,
        headers={"Authorization": f"Bearer {student_token}"},
    )

    # Teacher lists sessions - should only see their own
    response = await client.get(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert response.status_code == 200
    teacher_sessions = response.json()
    assert len(teacher_sessions) == 1
    assert teacher_sessions[0]["title"] == "선생님 촬영"

    # Student lists sessions - should only see their own
    response = await client.get(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert response.status_code == 200
    student_sessions = response.json()
    assert len(student_sessions) == 1
    assert student_sessions[0]["title"] == "학생 촬영"


@pytest.mark.asyncio
async def test_list_sessions_filter_by_year_and_month(
    client: AsyncClient,
    teacher_token: str,
):
    """Test filtering sessions by year/month for schedule planning."""
    await client.post(
        "/api/v1/sessions",
        json={
            "title": "3월 공원",
            "location": "서울숲",
            "date": "2024-03-15",
            "keywords": ["봄"],
        },
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    await client.post(
        "/api/v1/sessions",
        json={
            "title": "3월 박물관",
            "location": "국립중앙박물관",
            "date": "2024-03-28",
            "keywords": ["문화"],
        },
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    await client.post(
        "/api/v1/sessions",
        json={
            "title": "4월 바다",
            "location": "인천",
            "date": "2024-04-07",
            "keywords": ["바다"],
        },
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    response = await client.get(
        "/api/v1/sessions?year=2024&month=3",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(item["date"].startswith("2024-03") for item in data)


@pytest.mark.asyncio
async def test_list_sessions_filter_month_requires_year(
    client: AsyncClient,
    teacher_token: str,
):
    """Test month filter validation requires year query."""
    response = await client.get(
        "/api/v1/sessions?month=3",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_update_session_keywords(
    client: AsyncClient,
    teacher_token: str,
):
    """Test updating session keywords."""
    create_response = await client.post(
        "/api/v1/sessions",
        json={
            "title": "키워드 수정 테스트",
            "location": "서울",
            "date": "2024-06-10",
            "keywords": ["초기"],
        },
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    session_id = create_response.json()["id"]

    response = await client.patch(
        f"/api/v1/sessions/{session_id}/keywords",
        json={"keywords": ["여름", "미소", "여름"]},
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["keywords"] == ["여름", "미소"]


@pytest.mark.asyncio
async def test_create_session_invalid_date_format(
    client: AsyncClient,
    teacher_token: str,
):
    """Test creating session with invalid date format."""
    session_data = {
        "title": "테스트 촬영",
        "location": "서울",
        "date": "invalid-date",
    }

    response = await client.post(
        "/api/v1/sessions",
        json=session_data,
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_create_session_missing_required_field(
    client: AsyncClient,
    teacher_token: str,
):
    """Test creating session without required date field."""
    session_data = {
        "title": "테스트 촬영",
        "location": "서울",
        # missing date
    }

    response = await client.post(
        "/api/v1/sessions",
        json=session_data,
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 422  # Validation error
