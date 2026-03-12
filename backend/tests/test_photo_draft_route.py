import importlib
import logging
from collections.abc import Awaitable, Callable
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import httpx
import pytest

photos_route = importlib.import_module("app.routes.photos")
photo_schemas = importlib.import_module("app.schemas.photo")
DraftGenerationRequest = cast(type, photo_schemas.DraftGenerationRequest)

GenerateDraftFn = Callable[..., Awaitable[tuple[str, str]]]
GenerateDraftRoute = Callable[..., Awaitable[object]]
generate_draft_route = cast(GenerateDraftRoute, photos_route.generate_draft)


class _FakeResult:
    def __init__(self, photo: object) -> None:
        self._photo: object = photo

    def scalar_one_or_none(self) -> object:
        return self._photo


class _FakeSession:
    def __init__(self, photo: object) -> None:
        self._photo: object = photo

    async def execute(self, _statement: object) -> _FakeResult:
        return _FakeResult(self._photo)


@pytest.mark.asyncio
async def test_generate_draft_logs_provider_error_detail_on_gemini_403(
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = uuid4()
    photo_id = uuid4()
    photo = SimpleNamespace(id=photo_id, user_id=user_id, topic="용기", session_id=None)
    current_user = SimpleNamespace(id=user_id)
    payload = DraftGenerationRequest(tone="에세이", keywords=["햇살"], current_text="")
    db = _FakeSession(photo)

    async def raise_gemini_403(*_args: object, **_kwargs: object) -> tuple[str, str]:
        request = httpx.Request(
            "POST",
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        )
        response = httpx.Response(
            403,
            request=request,
            json={
                "error": {
                    "code": 403,
                    "message": "Your API key was reported as leaked. Please use another API key.",
                    "status": "PERMISSION_DENIED",
                }
            },
        )
        raise httpx.HTTPStatusError(
            "403 Client Error", request=request, response=response
        )

    monkeypatch.setattr(
        photos_route,
        "generate_draft_with_gemini",
        cast(GenerateDraftFn, raise_gemini_403),
    )

    with caplog.at_level(logging.WARNING):
        response = await generate_draft_route(
            photo_id=photo_id,
            payload=payload,
            current_user=current_user,
            db=db,
        )

    assert getattr(response, "source") == "fallback"
    assert getattr(response, "tone") == "에세이"
    assert getattr(response, "topic") == "용기"
    assert "PERMISSION_DENIED: Your API key was reported as leaked." in caplog.text
