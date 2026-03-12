import importlib
from collections.abc import Callable
from typing import cast


main_module = importlib.import_module("app.main")
expand_loopback_origin_aliases_fn: Callable[[str], list[str]] = cast(
    Callable[[str], list[str]],
    getattr(main_module, "_expand_loopback_origin_aliases"),
)


def test_expand_loopback_origin_aliases_adds_127_for_localhost() -> None:
    origins = expand_loopback_origin_aliases_fn("http://localhost:5173")

    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:5173" in origins


def test_expand_loopback_origin_aliases_adds_localhost_for_127() -> None:
    origins = expand_loopback_origin_aliases_fn("http://127.0.0.1:3000")

    assert "http://127.0.0.1:3000" in origins
    assert "http://localhost:3000" in origins


def test_expand_loopback_origin_aliases_keeps_non_loopback_only() -> None:
    origins = expand_loopback_origin_aliases_fn(
        "https://storylens.example.com,http://localhost:5173"
    )

    assert "https://storylens.example.com" in origins
    assert "https://127.0.0.1" not in origins
