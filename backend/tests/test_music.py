import importlib

import pytest


music_service = importlib.import_module("app.services.music")
build_music_prompt = music_service.build_music_prompt
normalize_music_style = music_service.normalize_music_style


def test_normalize_music_style_maps_legacy_mood_to_new_style() -> None:
    assert normalize_music_style("잔잔한") == "발라드"
    assert normalize_music_style("재즈") == "재즈"
    assert normalize_music_style("  ") is None


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
