"""Delete expired photo rows and their private local files."""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_templates import ImageGenerationJob
from app.models.edit_history import EditHistory
from app.models.photo import Photo


logger = logging.getLogger(__name__)
APP_ROOT = Path(__file__).resolve().parents[2]
UPLOAD_ROOT = (APP_ROOT / "uploads").resolve()


def _local_upload_path(url: str | None) -> Path | None:
    if not url or not url.startswith("/uploads/"):
        return None
    path = (APP_ROOT / url.lstrip("/")).resolve()
    try:
        path.relative_to(UPLOAD_ROOT)
    except ValueError:
        return None
    return path


async def purge_expired_photo_batch(db: AsyncSession, batch_size: int = 200) -> int:
    """Purge one locked batch; safe to run from more than one worker."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Photo)
        .where(Photo.expires_at.is_not(None), Photo.expires_at <= now)
        .order_by(Photo.expires_at.asc())
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )
    photos = list(result.scalars())
    if not photos:
        return 0

    photo_ids = [photo.id for photo in photos]
    file_paths = {
        path
        for photo in photos
        for path in (
            _local_upload_path(photo.original_url),
            _local_upload_path(photo.edited_url),
            _local_upload_path(photo.thumbnail_url),
        )
        if path is not None
    }

    await db.execute(delete(EditHistory).where(EditHistory.photo_id.in_(photo_ids)))
    await db.execute(
        update(ImageGenerationJob)
        .where(ImageGenerationJob.photo_id.in_(photo_ids))
        .values(photo_id=None, result_url=None)
    )
    await db.execute(
        update(ImageGenerationJob)
        .where(ImageGenerationJob.source_photo_id.in_(photo_ids))
        .values(source_photo_id=None)
    )
    await db.execute(delete(Photo).where(Photo.id.in_(photo_ids)))
    await db.commit()

    for path in file_paths:
        try:
            path.unlink(missing_ok=True)
        except OSError as exc:
            logger.warning("Failed to remove expired photo file %s: %s", path, exc)
    return len(photos)


async def purge_all_expired_photos(db: AsyncSession, batch_size: int = 200) -> int:
    total = 0
    while True:
        purged = await purge_expired_photo_batch(db, batch_size=batch_size)
        total += purged
        if purged < batch_size:
            return total
