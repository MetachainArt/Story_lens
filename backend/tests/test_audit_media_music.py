"""Regression tests use synthetic files and mocked DB/provider boundaries only."""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.routes import media, music, photos
from app.schemas.photo import PhotoUpdate
from app.services import photo_retention, writing
from app.api.v1 import ai_templates
from app.models.music_generation import MusicGenerationJob
from app.services.media_cleanup import remove_photo_music
from app.services import media_cleanup


class Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value

    def scalars(self):
        return iter(self.value)


def user():
    return SimpleNamespace(id=uuid4(), role="student", privacy_consent_at=datetime.now(timezone.utc), privacy_policy_version=settings.PRIVACY_POLICY_VERSION)


def photo(owner):
    return SimpleNamespace(id=uuid4(), user_id=owner.id, original_url=f"/uploads/photos/{owner.id}/original.jpg", edited_url=None, thumbnail_url=None, music_url=None)


@pytest.mark.parametrize("segment", ["../", "..\\", "%2e%2e/"])
def test_media_rejects_parent_segments(tmp_path, monkeypatch, segment):
    owner, other = uuid4(), uuid4()
    target = tmp_path / "uploads" / "photos" / str(other) / "private.jpg"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"synthetic image")
    monkeypatch.setattr(media, "APP_ROOT", tmp_path)
    monkeypatch.setattr(media, "UPLOAD_ROOT", tmp_path / "uploads")
    with pytest.raises(HTTPException):
        media._resolve_upload_path(f"uploads/photos/{owner}/{segment}{other}/private.jpg")


@pytest.mark.asyncio
async def test_edited_url_cannot_point_outside_owner(tmp_path, monkeypatch):
    owner = user()
    item = photo(owner)
    db = SimpleNamespace(execute=AsyncMock(return_value=Result(item)), commit=AsyncMock(), refresh=AsyncMock())
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    with pytest.raises(HTTPException) as exc:
        await photos.update_photo(item.id, PhotoUpdate(edited_url=f"/uploads/photos/{owner.id}/../{uuid4()}/private.jpg"), owner, db)
    assert exc.value.status_code == 400
    db.commit.assert_not_awaited()


def test_writing_does_not_read_another_owners_file(tmp_path, monkeypatch):
    owner = user()
    item = photo(owner)
    other = uuid4()
    target = tmp_path / "uploads" / "photos" / str(other) / "private.jpg"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"synthetic image")
    item.edited_url = f"/uploads/photos/{owner.id}/../{other}/private.jpg"
    monkeypatch.setattr(writing, "_BACKEND_ROOT", tmp_path)
    assert writing._read_image_file(item) is None


@pytest.mark.asyncio
async def test_music_unknown_task_never_calls_provider(monkeypatch):
    owner = user()
    item = photo(owner)
    monkeypatch.setattr(music, "_require_owned_photo", AsyncMock(return_value=item.id))
    provider = AsyncMock(return_value={"status": "PENDING"})
    monkeypatch.setattr(music, "check_music_status", provider)
    db = SimpleNamespace(execute=AsyncMock(return_value=Result(None)))
    with pytest.raises(HTTPException) as exc:
        await music.get_status("unknown-task", str(item.id), owner, db)
    assert exc.value.status_code == 404
    provider.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("retention", [False, True])
async def test_photo_deletion_removes_only_its_music(tmp_path, monkeypatch, retention):
    owner = user()
    item = photo(owner)
    own_dir = tmp_path / "uploads" / "music" / str(item.id)
    other_dir = tmp_path / "uploads" / "music" / str(uuid4())
    for folder in (own_dir, other_dir):
        folder.mkdir(parents=True)
        (folder / "track.mp3").write_bytes(b"synthetic audio")
    db = SimpleNamespace(execute=AsyncMock(return_value=Result([item] if retention else item)), delete=AsyncMock(), commit=AsyncMock())
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    monkeypatch.setattr(photo_retention, "APP_ROOT", tmp_path)
    monkeypatch.setattr(photo_retention, "UPLOAD_ROOT", tmp_path / "uploads")
    if retention:
        await photo_retention.purge_expired_photo_batch(db)
    else:
        await photos.delete_photo(item.id, owner, db)
    assert not (own_dir / "track.mp3").exists()
    assert (other_dir / "track.mp3").read_bytes() == b"synthetic audio"


@pytest.mark.asyncio
async def test_generation_persists_task_before_returning(monkeypatch):
    owner = user()
    item = photo(owner)
    monkeypatch.setattr(music, "_require_owned_photo", AsyncMock(return_value=item.id))
    monkeypatch.setattr(music, "generate_music", AsyncMock(return_value={"task_id": "provider-task"}))
    added = []
    db = SimpleNamespace(add=added.append, commit=AsyncMock())
    response = await music.start_generation(music.GenerateMusicRequest(photo_id=str(item.id), style="재즈"), owner, db)
    assert response.task_id == "provider-task"
    assert len(added) == 1
    job = added[0]
    assert isinstance(job, MusicGenerationJob)
    assert (job.user_id, job.photo_id, job.task_id) == (owner.id, item.id, response.task_id)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_generation_does_not_report_success_when_binding_save_fails(monkeypatch):
    owner = user()
    monkeypatch.setattr(music, "_require_owned_photo", AsyncMock(return_value=uuid4()))
    monkeypatch.setattr(music, "generate_music", AsyncMock(return_value={"task_id": "provider-task"}))
    db = SimpleNamespace(add=lambda job: None, commit=AsyncMock(side_effect=RuntimeError("synthetic DB failure")), rollback=AsyncMock())
    with pytest.raises(HTTPException) as exc:
        await music.start_generation(music.GenerateMusicRequest(photo_id=str(uuid4()), style="재즈"), owner, db)
    assert exc.value.status_code == 500
    db.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_owned_task_is_cached_and_requires_all_three_identity_fields(monkeypatch):
    owner = user()
    item = photo(owner)
    job = MusicGenerationJob(task_id="provider-task", user_id=owner.id, photo_id=item.id)
    monkeypatch.setattr(music, "_require_owned_photo", AsyncMock(return_value=item.id))
    provider = AsyncMock(return_value={"task_id": job.task_id, "status": "SUCCESS", "tracks": [{"audio_url": "https://example.invalid/track.mp3"}]})
    download = AsyncMock(return_value=f"/uploads/music/{item.id}/track.mp3")
    monkeypatch.setattr(music, "check_music_status", provider)
    monkeypatch.setattr(music, "download_music_file", download)

    async def execute(statement):
        # Verify the SQL boundary includes task, photo and current user, together.
        params = set(statement.compile().params.values())
        assert {job.task_id, item.id, owner.id} <= params
        return Result(job)

    db = SimpleNamespace(execute=execute, commit=AsyncMock())
    first = await music.get_status(job.task_id, str(item.id), owner, db)
    second = await music.get_status(job.task_id, str(item.id), owner, db)
    assert first == second
    assert first.tracks[0].local_url.endswith("track.mp3")
    provider.assert_awaited_once()
    download.assert_awaited_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_failed_photo_delete_keeps_music(tmp_path, monkeypatch):
    owner = user()
    item = photo(owner)
    target = tmp_path / "uploads" / "music" / str(item.id) / "track.mp3"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"synthetic audio")
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    db = SimpleNamespace(execute=AsyncMock(return_value=Result(item)), delete=AsyncMock(), commit=AsyncMock(side_effect=RuntimeError("synthetic DB failure")))
    with pytest.raises(RuntimeError):
        await photos.delete_photo(item.id, owner, db)
    assert target.exists()


@pytest.mark.asyncio
async def test_delete_legacy_malicious_url_preserves_other_user_file(tmp_path, monkeypatch):
    owner = user()
    item = photo(owner)
    other = uuid4()
    target = tmp_path / "uploads" / "photos" / str(other) / "private.jpg"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"synthetic image")
    item.edited_url = f"/uploads/photos/{owner.id}/../{other}/private.jpg"
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    db = SimpleNamespace(execute=AsyncMock(return_value=Result(item)), delete=AsyncMock(), commit=AsyncMock())
    await photos.delete_photo(item.id, owner, db)
    assert target.read_bytes() == b"synthetic image"


def test_ai_reference_and_cleanup_reject_other_owner(tmp_path, monkeypatch):
    owner, other = uuid4(), uuid4()
    target = tmp_path / "uploads" / "photos" / str(other) / "private.jpg"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"synthetic image")
    monkeypatch.setattr(ai_templates, "APP_ROOT", tmp_path)
    hostile = f"/uploads/photos/{owner}/../{other}/private.jpg"
    assert ai_templates._resolve_local_upload_path(hostile, owner) is None
    assert ai_templates._resolve_local_upload_path(f"/uploads/photos/{other}/private.jpg", owner) is None
    ai_templates._remove_local_upload(hostile, owner)
    assert target.exists()


def test_regular_owned_photo_is_readable(tmp_path, monkeypatch):
    owner = user()
    item = photo(owner)
    target = tmp_path / item.original_url.lstrip("/")
    target.parent.mkdir(parents=True)
    target.write_bytes(b"synthetic image")
    monkeypatch.setattr(media, "APP_ROOT", tmp_path)
    monkeypatch.setattr(writing, "_BACKEND_ROOT", tmp_path)
    normalized, resolved = media._resolve_upload_path(item.original_url)
    assert normalized == item.original_url.lstrip("/")
    assert resolved == target
    assert writing._read_image_file(item) is not None


@pytest.mark.asyncio
async def test_download_url_does_not_sign_another_owners_path(tmp_path, monkeypatch):
    owner = user()
    item = photo(owner)
    item.edited_url = f"/uploads/photos/{uuid4()}/private.jpg"
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    monkeypatch.setattr(photos, "_get_photo_for_viewer", AsyncMock(return_value=item))
    with pytest.raises(HTTPException) as exc:
        await photos.get_photo_download_url(item.id, owner, object())
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_music_cache_save_failure_removes_only_new_downloads(tmp_path, monkeypatch):
    owner = user()
    item = photo(owner)
    folder = tmp_path / "uploads" / "music" / str(item.id)
    folder.mkdir(parents=True)
    existing = folder / "existing.mp3"
    existing.write_bytes(b"existing saved audio")
    downloaded = folder / "new.mp3"
    monkeypatch.setattr(music, "_require_owned_photo", AsyncMock(return_value=item.id))
    monkeypatch.setattr(music, "APP_ROOT", tmp_path, raising=False)
    monkeypatch.setattr(music, "check_music_status", AsyncMock(return_value={"status": "SUCCESS", "tracks": [{"audio_url": "https://example.invalid/audio.mp3"}]}))

    async def download(*args):
        downloaded.write_bytes(b"new synthetic audio")
        return f"/uploads/music/{item.id}/new.mp3"

    monkeypatch.setattr(music, "download_music_file", download)
    job = MusicGenerationJob(task_id="synthetic-task", user_id=owner.id, photo_id=item.id)
    db = SimpleNamespace(execute=AsyncMock(return_value=Result(job)), commit=AsyncMock(side_effect=RuntimeError("synthetic DB failure")), rollback=AsyncMock())
    with pytest.raises(RuntimeError):
        await music.get_status(job.task_id, str(item.id), owner, db)
    assert not downloaded.exists()
    assert existing.read_bytes() == b"existing saved audio"
    db.rollback.assert_awaited_once()


def test_music_cleanup_does_not_follow_junction_or_symlink(tmp_path):
    import os
    import subprocess

    own_id, other_id = uuid4(), uuid4()
    other = tmp_path / "uploads" / "music" / str(other_id)
    other.mkdir(parents=True)
    protected = other / "protected.mp3"
    protected.write_bytes(b"other photo audio")
    alias = other.parent / str(own_id)
    if os.name == "nt":
        result = subprocess.run(["cmd", "/c", "mklink", "/J", str(alias), str(other)], capture_output=True)
        assert result.returncode == 0, "Synthetic test junction creation failed"
    else:
        alias.symlink_to(other, target_is_directory=True)
    try:
        remove_photo_music(tmp_path, own_id)
        assert protected.read_bytes() == b"other photo audio"
        assert alias.exists()
    finally:
        # Remove only the test link itself; never recursively delete its target.
        if os.name == "nt":
            alias.rmdir()
        else:
            alias.unlink()


@pytest.mark.asyncio
async def test_edited_save_rollback_does_not_read_expired_user(tmp_path, monkeypatch):
    owner = user()
    item = photo(owner)
    owner_id = owner.id
    class ExpiringUser:
        expired = False
        privacy_consent_at = owner.privacy_consent_at
        privacy_policy_version = owner.privacy_policy_version
        @property
        def id(self):
            if self.expired:
                raise AssertionError("Expired ORM attribute was accessed after rollback")
            return owner_id
    expiring = ExpiringUser()
    target = tmp_path / "uploads" / "photos" / str(owner_id) / "new.jpg"
    target.parent.mkdir(parents=True)
    target.write_bytes(b"synthetic image")
    monkeypatch.setattr(photos, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos"))
    monkeypatch.setattr(photos, "_save_data_url_image", lambda *args: f"/uploads/photos/{owner_id}/new.jpg")
    async def rollback():
        expiring.expired = True
    db = SimpleNamespace(execute=AsyncMock(return_value=Result(item)), commit=AsyncMock(side_effect=RuntimeError("synthetic DB failure")), rollback=rollback)
    with pytest.raises(HTTPException) as exc:
        await photos.update_photo(item.id, PhotoUpdate(edited_url="data:image/png;base64,synthetic"), expiring, db)
    assert exc.value.status_code == 500
    assert not target.exists()


@pytest.mark.asyncio
async def test_partial_music_download_is_retried_without_redownloading_saved_track(monkeypatch):
    owner = user()
    item = photo(owner)
    job = MusicGenerationJob(task_id="synthetic-task", user_id=owner.id, photo_id=item.id)
    monkeypatch.setattr(music, "_require_owned_photo", AsyncMock(return_value=item.id))
    provider = AsyncMock(return_value={"status": "SUCCESS", "tracks": [{"audio_url": "https://example.invalid/1.mp3"}, {"audio_url": "https://example.invalid/2.mp3"}]})
    monkeypatch.setattr(music, "check_music_status", provider)
    download = AsyncMock(side_effect=[f"/uploads/music/{item.id}/1.mp3", ValueError("synthetic network failure"), f"/uploads/music/{item.id}/2.mp3"])
    monkeypatch.setattr(music, "download_music_file", download)
    db = SimpleNamespace(execute=AsyncMock(return_value=Result(job)), commit=AsyncMock())
    first = await music.get_status(job.task_id, str(item.id), owner, db)
    assert first.tracks[1].local_url == ""
    second = await music.get_status(job.task_id, str(item.id), owner, db)
    assert second.tracks[1].local_url.endswith("/2.mp3")
    assert second.tracks[0].local_url == first.tracks[0].local_url
    assert download.await_count == 3


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["photo", "music", "music_directory"])
async def test_failed_cleanup_is_retried_on_next_retention_run(tmp_path, monkeypatch, kind):
    from pathlib import Path
    import shutil

    scope_id = uuid4()
    folder = "photos" if kind == "photo" else "music"
    url = f"/uploads/{folder}/{scope_id}/synthetic.bin"
    target = tmp_path / url.lstrip("/")
    target.parent.mkdir(parents=True)
    target.write_bytes(b"synthetic private asset")
    real_unlink, real_rmtree = Path.unlink, shutil.rmtree

    def fail_unlink(self, *args, **kwargs):
        if self == target:
            raise PermissionError("synthetic temporary file lock")
        return real_unlink(self, *args, **kwargs)

    if kind == "music_directory":
        monkeypatch.setattr(shutil, "rmtree", lambda *args, **kwargs: (_ for _ in ()).throw(PermissionError("synthetic directory lock")))
        media_cleanup.remove_photo_music(tmp_path, scope_id)
    else:
        monkeypatch.setattr(Path, "unlink", fail_unlink)
        if kind == "photo":
            media_cleanup.remove_photo_file(tmp_path, url, scope_id)
        else:
            media_cleanup.remove_music_file(tmp_path, url, scope_id)
    assert target.exists()
    assert len(list((tmp_path / "uploads" / ".cleanup-pending").glob("*.json"))) == 1
    monkeypatch.setattr(photo_retention, "APP_ROOT", tmp_path)
    db = SimpleNamespace(execute=AsyncMock(return_value=Result([])))
    assert await photo_retention.purge_all_expired_photos(db) == 0
    assert target.exists()
    assert len(list((tmp_path / "uploads" / ".cleanup-pending").glob("*.json"))) == 1
    monkeypatch.setattr(Path, "unlink", real_unlink)
    monkeypatch.setattr(shutil, "rmtree", real_rmtree)
    assert await photo_retention.purge_all_expired_photos(db) == 0
    assert not target.exists()
    assert list((tmp_path / "uploads" / ".cleanup-pending").glob("*.json")) == []
