from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1 import auth, users
from app.schemas import auth as auth_schemas


def _empty_result() -> MagicMock:
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    return result


@pytest.mark.asyncio
async def test_teacher_student_list_query_is_scoped_to_teacher_id() -> None:
    teacher = SimpleNamespace(id=uuid4(), role="teacher")
    db = AsyncMock()
    db.execute.return_value = _empty_result()

    await users.list_students(teacher, db, skip=0, limit=50)

    statement = db.execute.await_args.args[0]
    assert "users.teacher_id" in str(statement.whereclause)


@pytest.mark.asyncio
async def test_parent_cannot_list_unlinked_students() -> None:
    parent = SimpleNamespace(id=uuid4(), role="parent")
    db = AsyncMock()
    db.execute.return_value = _empty_result()

    with pytest.raises(HTTPException) as exc_info:
        await users.list_students(parent, db, skip=0, limit=50)

    assert exc_info.value.status_code == 403
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_public_teacher_registration_is_disabled_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth.settings, "ALLOW_TEACHER_REGISTRATION", False)

    with pytest.raises(HTTPException) as exc_info:
        await auth.register(SimpleNamespace(), AsyncMock())

    assert exc_info.value.status_code == 403


def test_template_manager_capability_comes_from_server_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth_schemas.settings, "TEMPLATE_MANAGER_EMAIL", "manager-id")

    manager = auth_schemas.UserInToken(
        id=uuid4(),
        name="Manager",
        email="MANAGER-ID",
        role="teacher",
    )
    regular_teacher = auth_schemas.UserInToken(
        id=uuid4(),
        name="Teacher",
        email="teacher@example.com",
        role="teacher",
    )

    assert manager.can_manage_templates is True
    assert regular_teacher.can_manage_templates is False
