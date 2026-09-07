"""Real PostgreSQL authorization/FK checks, skipped without a dedicated test DB."""
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.models.photo import Photo
from app.models.music_generation import MusicGenerationJob
from app.routes import music


@pytest.mark.asyncio
async def test_music_task_is_not_transferable_between_users_or_photos(
    client, db_session, test_photo, test_student, test_teacher,
    student_token, teacher_token, monkeypatch,
):
    student_other_photo = Photo(user_id=test_student.id, original_url="https://example.invalid/student.jpg")
    teacher_photo = Photo(user_id=test_teacher.id, original_url="https://example.invalid/teacher.jpg")
    db_session.add_all([student_other_photo, teacher_photo])
    await db_session.flush()
    db_session.add(MusicGenerationJob(
        task_id="synthetic-owned-task", user_id=test_student.id, photo_id=test_photo.id,
        result_payload={"status": "SUCCESS", "task_id": "synthetic-owned-task", "tracks": []},
    ))
    await db_session.commit()
    provider = AsyncMock(side_effect=AssertionError("Provider must not be called"))
    monkeypatch.setattr(music, "check_music_status", provider)

    for token, photo_id in [(student_token, student_other_photo.id), (teacher_token, teacher_photo.id)]:
        response = await client.get(
            "/api/v1/music/status/synthetic-owned-task", params={"photo_id": str(photo_id)},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404
    own = await client.get(
        "/api/v1/music/status/synthetic-owned-task", params={"photo_id": str(test_photo.id)},
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert own.status_code == 200
    assert own.json()["status"] == "SUCCESS"
    provider.assert_not_awaited()


@pytest.mark.asyncio
async def test_deleting_photo_cascades_its_music_authorization(db_session, test_photo, test_student):
    db_session.add(MusicGenerationJob(task_id="synthetic-cascade-task", user_id=test_student.id, photo_id=test_photo.id))
    await db_session.commit()
    await db_session.delete(test_photo)
    await db_session.commit()
    assert (await db_session.execute(select(MusicGenerationJob).where(MusicGenerationJob.task_id == "synthetic-cascade-task"))).scalar_one_or_none() is None
