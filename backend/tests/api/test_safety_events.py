"""Safety events contain what a student typed, so they are scoped per teacher."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, get_password_hash
from app.models.ai_templates import SafetyEvent
from app.models.user import User


async def _add_user(
    db: AsyncSession,
    *,
    email: str,
    role: str,
    teacher: User | None = None,
) -> User:
    user = User(
        name=email.split("@", 1)[0],
        email=email,
        password_hash=get_password_hash("password123"),
        role=role,
        teacher_id=teacher.id if teacher else None,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.mark.asyncio
async def test_teacher_only_sees_safety_events_from_their_own_students(
    client: AsyncClient,
    db_session: AsyncSession,
    test_teacher: User,
    test_student: User,
    teacher_token: str,
):
    other_teacher = await _add_user(
        db_session, email="other-teacher@storylens.com", role="teacher"
    )
    other_student = await _add_user(
        db_session,
        email="other-student@storylens.com",
        role="student",
        teacher=other_teacher,
    )
    db_session.add_all(
        [
            SafetyEvent(
                user_id=test_student.id,
                reason="scary",
                input_text="우리 반 학생 입력",
                metadata_json={},
            ),
            SafetyEvent(
                user_id=test_teacher.id,
                reason="scary",
                input_text="내가 직접 입력",
                metadata_json={},
            ),
            SafetyEvent(
                user_id=other_student.id,
                reason="private_info",
                input_text="다른 반 학생 입력",
                metadata_json={},
            ),
            SafetyEvent(
                user_id=None,
                reason="scary",
                input_text="소유자 없는 기록",
                metadata_json={},
            ),
        ]
    )
    await db_session.commit()

    response = await client.get(
        "/api/v1/admin/safety-events",
        headers={"Authorization": f"Bearer {teacher_token}"},
    )

    assert response.status_code == 200
    texts = {event["input_text"] for event in response.json()}
    assert texts == {"우리 반 학생 입력", "내가 직접 입력"}

    other_response = await client.get(
        "/api/v1/admin/safety-events",
        headers={
            "Authorization": f"Bearer {create_access_token(subject=other_teacher.id)}"
        },
    )
    assert other_response.status_code == 200
    assert {event["input_text"] for event in other_response.json()} == {
        "다른 반 학생 입력"
    }


@pytest.mark.asyncio
async def test_student_cannot_read_safety_events(
    client: AsyncClient,
    student_token: str,
):
    response = await client.get(
        "/api/v1/admin/safety-events",
        headers={"Authorization": f"Bearer {student_token}"},
    )

    assert response.status_code == 403
