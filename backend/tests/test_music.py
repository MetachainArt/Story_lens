import importlib
from collections.abc import Awaitable, Callable
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException


music_service = importlib.import_module("app.services.music")
music_route = importlib.import_module("app.routes.music")
build_music_prompt = music_service.build_music_prompt
normalize_music_style = music_service.normalize_music_style
extract_kie_error_message = music_service.extract_kie_error_message
GenerateMusicRequest = music_route.GenerateMusicRequest
GenerateMusicFn = Callable[..., Awaitable[dict[str, str]]]


class _ScalarResult:
    def __init__(self, value: object) -> None:
        self.value = value

    def scalar_one_or_none(self) -> object:
        return self.value


class _PhotoLookupDb:
    def __init__(self, value: object) -> None:
        self.value = value

    async def execute(self, _statement: object) -> _ScalarResult:
        return _ScalarResult(self.value)


def test_normalize_music_style_maps_legacy_mood_to_new_style() -> None:
    assert normalize_music_style("잔잔한") == "발라드"
    assert normalize_music_style("재즈") == "재즈"
    assert normalize_music_style("  ") is None


def test_extract_kie_error_message_reads_kie_response_body() -> None:
    request = httpx.Request("POST", "https://api.kie.ai/api/v1/generate")
    response = httpx.Response(
        401,
        request=request,
        json={"code": 401, "msg": "Invalid API key", "data": None},
    )

    assert extract_kie_error_message(response) == "Kie.ai code 401: Invalid API key"


@pytest.mark.asyncio
async def test_music_generation_rejects_a_photo_owned_by_someone_else() -> None:
    with pytest.raises(HTTPException) as exc_info:
        await music_route._require_owned_photo(
            _PhotoLookupDb(None),
            uuid4(),
            str(uuid4()),
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_build_music_prompt_uses_genre_style_for_instrumental() -> None:
    prompt, style_prompt, instrumental = await build_music_prompt(
        topic="봄 산책",
        style="재즈",
        draft_text="",
    )

    assert instrumental is True
    assert "Genre/style: 재즈." in prompt
    assert "Jazz trio" in style_prompt


@pytest.mark.asyncio
async def test_start_generation_returns_kie_provider_detail_on_http_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def allow_owned_photo(*_args: object, **_kwargs: object):
        return uuid4()

    async def raise_kie_http_error(*_args: object, **_kwargs: object) -> dict[str, str]:
        request = httpx.Request("POST", "https://api.kie.ai/api/v1/generate")
        response = httpx.Response(
            402,
            request=request,
            json={"code": 402, "msg": "Insufficient Credits", "data": None},
        )
        raise httpx.HTTPStatusError(
            "402 Client Error", request=request, response=response
        )

    monkeypatch.setattr(
        music_route,
        "generate_music",
        cast(GenerateMusicFn, raise_kie_http_error),
    )
    monkeypatch.setattr(music_route, "_require_owned_photo", allow_owned_photo)

    with pytest.raises(HTTPException) as exc_info:
        await music_route.start_generation(
            body=GenerateMusicRequest(
                topic="사랑",
                style="재즈",
                draft_text="",
                photo_id=str(uuid4()),
            ),
            current_user=SimpleNamespace(id=uuid4()),
            db=object(),
        )

    assert exc_info.value.status_code == 502
    assert exc_info.value.detail == "Kie.ai code 402: Insufficient Credits"
