"""Functional audit regressions, using synthetic files and provider boundaries."""
import base64
import builtins
from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image

from app.core.config import settings
from app.routes import photos
from app.schemas.photo import PhotoUpdate
from app.services import media_cleanup, music, photo_retention, safety, writing


def image_bytes():
    buffer = BytesIO()
    Image.new("RGB", (3, 2), (30, 70, 110)).save(buffer, format="PNG")
    return buffer.getvalue()


def owner_and_photo():
    owner = SimpleNamespace(id=uuid4(), role="student", privacy_consent_at=datetime.now(timezone.utc), privacy_policy_version=settings.PRIVACY_POLICY_VERSION)
    photo = SimpleNamespace(id=uuid4(), user_id=owner.id, original_url=f"/uploads/photos/{owner.id}/original.png", edited_url=None, thumbnail_url=None, music_url=None, content="이미 작성한 글")
    return owner, photo


class Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return iter(self.value)


def database(photo, *, reference=None, retention=False):
    async def execute(statement):
        if getattr(statement, "is_select", False):
            # Photo retrieval and file-reference lookups are different queries.
            expression = statement.column_descriptions[0]["expr"]
            if expression is photos.Photo:
                return Result([photo] if retention else photo)
            return Result(reference)
        return Result(None)
    return SimpleNamespace(execute=AsyncMock(side_effect=execute), commit=AsyncMock(), refresh=AsyncMock(), rollback=AsyncMock(), delete=AsyncMock())


@pytest.mark.asyncio
@pytest.mark.parametrize("file_state", ["missing", "invalid", "valid"])
async def test_local_edit_requires_an_existing_valid_image(tmp_path, monkeypatch, file_state):
    owner, photo = owner_and_photo()
    folder = tmp_path / "uploads" / "photos" / str(owner.id)
    folder.mkdir(parents=True)
    target = folder / "edited.png"
    if file_state != "missing":
        target.write_bytes(image_bytes() if file_state == "valid" else b"not an image")
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(folder.parent))
    db = database(photo)
    payload = PhotoUpdate(edited_url=f"/uploads/photos/{owner.id}/edited.png")
    if file_state == "valid":
        await photos.update_photo(photo.id, payload, owner, db)
        db.commit.assert_awaited_once()
    else:
        with pytest.raises(HTTPException) as error:
            await photos.update_photo(photo.id, payload, owner, db)
        assert error.value.status_code == 400
        db.commit.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("suffix", [" ", "\t", "\n"])
async def test_local_edit_rejects_whitespace_aliases(tmp_path, monkeypatch, suffix):
    owner, photo = owner_and_photo()
    target = tmp_path / photo.original_url.lstrip("/")
    target.parent.mkdir(parents=True)
    target.write_bytes(image_bytes())
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(target.parent.parent))
    db = database(photo)
    with pytest.raises(HTTPException) as error:
        await photos.update_photo(photo.id, PhotoUpdate(edited_url=photo.original_url + suffix), owner, db)
    assert error.value.status_code == 400
    db.commit.assert_not_awaited()
    assert photo.edited_url is None
    assert target.read_bytes() == image_bytes()


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["update", "upload", "delete", "retention"])
async def test_shared_original_survives_edit_replacement_and_deletion(tmp_path, monkeypatch, operation):
    owner, photo = owner_and_photo()
    shared_url = f"/uploads/photos/{owner.id}/other-photo-original.png"
    shared_file = tmp_path / shared_url.lstrip("/")
    shared_file.parent.mkdir(parents=True)
    shared_file.write_bytes(image_bytes())
    photo.edited_url = shared_url
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(shared_file.parent.parent))
    monkeypatch.setattr(photo_retention, "APP_ROOT", tmp_path)
    db = database(photo, reference=uuid4(), retention=operation == "retention")
    if operation == "update":
        await photos.update_photo(photo.id, PhotoUpdate(edited_url="data:image/png;base64," + base64.b64encode(image_bytes()).decode()), owner, db)
    elif operation == "upload":
        await photos.upload_edited_photo(photo.id, owner, UploadFile(BytesIO(image_bytes()), filename="new.png"), None, db)
    elif operation == "delete":
        await photos.delete_photo(photo.id, owner, db)
    else:
        await photo_retention.purge_expired_photo_batch(db)
    assert shared_file.read_bytes() == image_bytes()


@pytest.mark.asyncio
async def test_unreferenced_previous_edit_is_still_removed(tmp_path, monkeypatch):
    owner, photo = owner_and_photo()
    photo.edited_url = f"/uploads/photos/{owner.id}/old.png"
    old_file = tmp_path / photo.edited_url.lstrip("/")
    old_file.parent.mkdir(parents=True)
    old_file.write_bytes(image_bytes())
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(old_file.parent.parent))
    db = database(photo)
    await photos.update_photo(photo.id, PhotoUpdate(edited_url="data:image/png;base64," + base64.b64encode(image_bytes()).decode()), owner, db)
    assert not old_file.exists()
    assert (tmp_path / photo.edited_url.lstrip("/")).is_file()


@pytest.mark.asyncio
async def test_invalid_music_does_not_write_an_orphan_edit(tmp_path, monkeypatch):
    owner, photo = owner_and_photo()
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    db = database(photo)
    payload = PhotoUpdate(edited_url="data:image/png;base64," + base64.b64encode(image_bytes()).decode(), music_url="http://example.invalid/invalid.mp3")
    with pytest.raises(HTTPException) as error:
        await photos.update_photo(photo.id, payload, owner, db)
    assert error.value.status_code == 400
    assert list(tmp_path.rglob("*.png")) == []
    db.commit.assert_not_awaited()


def test_failed_data_image_write_removes_partial_file(tmp_path, monkeypatch):
    owner, _ = owner_and_photo()
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    real_open = builtins.open

    class InterruptedFile:
        def __init__(self, *args, **kwargs):
            self.stream = real_open(*args, **kwargs)

        def __enter__(self):
            return self

        def __exit__(self, *_):
            self.stream.close()

        def write(self, data):
            self.stream.write(data[:10])
            raise OSError("synthetic disk interruption")

    monkeypatch.setattr(photos, "open", InterruptedFile, raising=False)
    with pytest.raises(HTTPException) as error:
        photos._save_data_url_image("data:image/png;base64," + base64.b64encode(image_bytes()).decode(), owner.id)
    assert error.value.status_code == 500
    assert list(tmp_path.rglob("*.png")) == []


@pytest.mark.asyncio
async def test_failed_multipart_image_write_removes_partial_file(tmp_path, monkeypatch):
    owner, photo = owner_and_photo()
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    db = database(photo)

    class InterruptedFile:
        def __init__(self, *args, **kwargs):
            self.stream = builtins.open(*args, **kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            self.stream.close()

        async def write(self, data):
            self.stream.write(data[:10])
            raise OSError("synthetic multipart disk interruption")

    monkeypatch.setattr(photos.anyio, "open_file", AsyncMock(side_effect=InterruptedFile))
    with pytest.raises(HTTPException) as error:
        await photos.upload_edited_photo(photo.id, owner, UploadFile(BytesIO(image_bytes()), filename="new.png"), None, db)
    assert error.value.status_code == 500
    db.commit.assert_not_awaited()
    assert photo.edited_url is None
    assert list(tmp_path.rglob("*.png")) == []


@pytest.mark.asyncio
async def test_cleanup_retry_keeps_a_file_that_gained_a_reference(tmp_path):
    owner, photo = owner_and_photo()
    target = tmp_path / photo.original_url.lstrip("/")
    target.parent.mkdir(parents=True)
    target.write_bytes(image_bytes())
    media_cleanup._queue_cleanup(tmp_path, "photo", photo.original_url, owner.id)
    assert await media_cleanup.retry_pending_media_cleanup(database(photo, reference=photo.id), tmp_path) == 1
    assert target.read_bytes() == image_bytes()


def mock_provider(monkeypatch, module, response_json, status=200, error=None):
    client_type = httpx.AsyncClient
    def respond(request):
        if error:
            raise error
        return httpx.Response(status, json=response_json, request=request)
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **kwargs: client_type(transport=httpx.MockTransport(respond), **kwargs))


@pytest.mark.asyncio
@pytest.mark.parametrize("mode,expected_status", [("unconfigured", 503), ("http_error", 502), ("empty", 502), ("blank", 502), ("malformed", 502), ("timeout", 504)])
async def test_chat_failure_is_an_error_and_preserves_existing_content(monkeypatch, mode, expected_status):
    owner, photo = owner_and_photo()
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "" if mode == "unconfigured" else "synthetic-provider-key")
    monkeypatch.setattr(writing, "_read_image_file", lambda _: None)
    responses = {"empty": {"candidates": []}, "blank": {"candidates": [{"content": {"parts": [{"text": "  "}]}}]}, "malformed": {"candidates": [None]}}
    mock_provider(monkeypatch, writing, responses.get(mode, {}), status=503 if mode == "http_error" else 200, error=httpx.ReadTimeout("synthetic timeout") if mode == "timeout" else None)
    with pytest.raises(HTTPException) as error:
        await photos.chat_write(photo.id, photos.ChatWriteRequest(compile_story=True), owner, database(photo))
    assert error.value.status_code == expected_status
    assert photo.content == "이미 작성한 글"


@pytest.mark.asyncio
async def test_successful_chat_keeps_real_reply(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic-provider-key")
    monkeypatch.setattr(writing, "_read_image_file", lambda _: None)
    mock_provider(monkeypatch, writing, {"candidates": [{"content": {"parts": [{"text": "사진 속 바다가 기억나요."}]}}]})
    _, photo = owner_and_photo()
    assert await writing.chat_write_with_gemini(photo, "바다", "좋았어", [], 0) == "사진 속 바다가 기억나요."


@pytest.mark.parametrize("text", ["피부결 유지", "커피를 마시는 친구", "피아노 연주", "연필과 크레파스", "portrait drawing skills", "봄 소풍"])
def test_safe_topics_are_not_rejected_by_partial_violence_words(text):
    assert safety.screen_prompt(text).allowed


@pytest.mark.parametrize("text", ["피가 흐르는 장면", "피 묻은 칼", "총으로 쏘는 장면", "살인 장면", "사람을 죽이는 모습", "핏자국", "blood and guns", "killing", "handgun", "shotguns", "gunshots", "killer", "murderers", "자해", "폭탄", "선정적인 노출", "혐오"])
def test_harmful_topics_remain_blocked(text):
    assert not safety.screen_prompt(text).allowed


@pytest.mark.asyncio
@pytest.mark.parametrize("track_fields,expected", [({"prompt": "[Verse 1]\n우리는 걸어요"}, "[Verse 1]\n우리는 걸어요"), ({"lyrics": "명시적 가사", "prompt": "생성 프롬프트"}, "명시적 가사"), ({}, "")])
async def test_music_status_preserves_provider_lyrics(monkeypatch, track_fields, expected):
    monkeypatch.setattr(settings, "KIE_API_KEY", "synthetic-provider-key")
    mock_provider(monkeypatch, music, {"code": 200, "data": {"status": "SUCCESS", "response": {"sunoData": [{"id": "track", "audioUrl": "https://example.invalid/track.mp3", **track_fields}]}}})
    result = await music.check_music_status("synthetic-task")
    assert result["tracks"][0]["lyric"] == expected
