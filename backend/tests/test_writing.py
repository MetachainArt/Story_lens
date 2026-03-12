import importlib
from typing import Callable, cast

import httpx


writing_service = importlib.import_module("app.services.writing")
extract_provider_error_message = cast(
    Callable[[httpx.Response], str | None],
    writing_service.extract_provider_error_message,
)


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
