import importlib
from types import SimpleNamespace
from typing import Callable, cast

import httpx


writing_service = importlib.import_module("app.services.writing")
extract_provider_error_message = cast(
    Callable[[httpx.Response], str | None],
    writing_service.extract_provider_error_message,
)
build_photobook_copy_fallback = writing_service.build_photobook_copy_fallback
parse_photobook_copy_response = writing_service.parse_photobook_copy_response


def test_extract_provider_error_message_reads_google_error_payload() -> None:
    request = httpx.Request("POST", "https://example.com")
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

    detail = extract_provider_error_message(response)

    assert (
        detail
        == "PERMISSION_DENIED: Your API key was reported as leaked. Please use another API key."
    )


def test_extract_provider_error_message_reads_plain_text_payload() -> None:
    request = httpx.Request("POST", "https://example.com")
    response = httpx.Response(500, request=request, text="upstream unavailable")

    detail = extract_provider_error_message(response)

    assert detail == "upstream unavailable"


def test_photobook_copy_parser_reads_structured_photo_specific_copy() -> None:
    title, content = parse_photobook_copy_response(
        '{"title":"무대 위의 선율","content":"기타를 든 사람이 조명 아래에서 연주에 집중하고 있습니다."}'
    )

    assert title == "무대 위의 선율"
    assert content == "기타를 든 사람이 조명 아래에서 연주에 집중하고 있습니다."


def test_photobook_copy_fallback_rejects_generic_ai_metadata() -> None:
    photo = SimpleNamespace(
        title="AI 사진보정",
        topic="AI 이미지",
        content=None,
        created_at=None,
    )

    title, content = build_photobook_copy_fallback(photo, sequence=2)

    assert title == "기억의 장면 02"
    assert "AI" not in title
    assert content
