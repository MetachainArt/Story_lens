"""Ownership-scoped cleanup shared by manual and retention deletion."""
import logging
import hashlib
import json
from itertools import islice
from pathlib import Path
import shutil
from uuid import UUID, uuid4

from app.core.upload_paths import resolve_upload_path

logger = logging.getLogger(__name__)


def _pending_directory(app_root: Path) -> Path:
    directory = app_root.resolve() / "uploads" / ".cleanup-pending"
    if directory.resolve() != directory:
        raise OSError("Cleanup record directory must not be a link")
    return directory


def _queue_cleanup(app_root: Path, kind: str, url: str, scope_id: UUID) -> None:
    """One small atomic file per failed cleanup; shared API/worker writers do not collide."""
    record = {"kind": kind, "url": url, "scope_id": str(scope_id)}
    payload = json.dumps(record, sort_keys=True)
    record_id = hashlib.sha256(payload.encode()).hexdigest()
    temporary: Path | None = None
    try:
        directory = _pending_directory(app_root)
        directory.mkdir(parents=True, exist_ok=True)
        temporary = directory / f".{uuid4()}.tmp"
        temporary.write_text(payload, encoding="utf-8")
        temporary.replace(directory / f"{record_id}.json")
    except OSError:
        # If even the recovery record cannot be written, leave an actionable
        # local relative path and scope ID (never media bytes or signed URLs).
        logger.error("Cleanup record could not be saved: kind=%s scope=%s path=%s", kind, scope_id, url)
    finally:
        if temporary is not None:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def remove_photo_file(app_root: Path, url: str | None, owner_id: UUID, *, _retry: bool = False) -> bool:
    path = resolve_upload_path(app_root, url, photo_owner=owner_id)
    if path is None:
        return True
    try:
        path.unlink(missing_ok=True)
    except OSError:
        if not _retry:
            _queue_cleanup(app_root, "photo", str(url), owner_id)
        return False
    return True


def remove_photo_music(app_root: Path, photo_id: UUID, *, _retry: bool = False) -> bool:
    # Resolve a synthetic leaf to apply exactly the same boundary/symlink checks.
    leaf = resolve_upload_path(app_root, f"/uploads/music/{photo_id}/cleanup-check")
    if leaf is None:
        return True
    directory = leaf.parent
    try:
        if directory.is_dir():
            shutil.rmtree(directory)
    except OSError:
        if not _retry:
            _queue_cleanup(app_root, "music_directory", f"/uploads/music/{photo_id}/cleanup-check", photo_id)
        return False
    return True


def remove_music_file(app_root: Path, url: str, photo_id: UUID, *, _retry: bool = False) -> bool:
    path = resolve_upload_path(app_root, url)
    if path is None or path.parent != app_root.resolve() / "uploads" / "music" / str(photo_id):
        return True
    try:
        path.unlink(missing_ok=True)
    except OSError:
        if not _retry:
            _queue_cleanup(app_root, "music", url, photo_id)
        return False
    return True


def retry_pending_media_cleanup(app_root: Path, limit: int = 200) -> int:
    """Replay bounded local cleanup records, even when no Photo rows expire."""
    try:
        directory = _pending_directory(app_root)
    except OSError:
        logger.error("Cleanup recovery directory is unsafe")
        return 0
    completed = 0
    for record_path in islice(directory.glob("*.json"), limit):
        try:
            if record_path.is_symlink() or record_path.stat().st_size > 4096:
                continue
            record = json.loads(record_path.read_text(encoding="utf-8"))
            scope_id = UUID(record["scope_id"])
            url = record["url"]
            if not isinstance(url, str):
                continue
            kind = record["kind"]
            if kind == "photo":
                success = remove_photo_file(app_root, url, scope_id, _retry=True)
            elif kind == "music":
                success = remove_music_file(app_root, url, scope_id, _retry=True)
            elif kind == "music_directory":
                success = remove_photo_music(app_root, scope_id, _retry=True)
            else:
                continue
            if success:
                record_path.unlink(missing_ok=True)
                completed += 1
        except (OSError, ValueError, KeyError, TypeError):
            logger.warning("A cleanup recovery record could not be processed")
    return completed
