"""Built-in template preview assets stay in sync with seed metadata."""

from pathlib import Path

from app.services.ai_defaults import (
    CUSTOM_TEMPLATE_PREVIEW_URLS,
    RETOUCH_TEMPLATE_PREVIEWS,
    _preview_urls_by_template_name,
)


def test_every_builtin_preview_url_has_a_webp_file():
    static_root = Path(__file__).resolve().parents[1] / "app" / "static"
    urls = {
        *_preview_urls_by_template_name().values(),
        *CUSTOM_TEMPLATE_PREVIEW_URLS.values(),
        *RETOUCH_TEMPLATE_PREVIEWS.values(),
    }

    assert urls
    assert all(url.endswith(".webp") for url in urls)
    missing = [url for url in urls if not (static_root / url.lstrip("/")).is_file()]
    assert missing == []
