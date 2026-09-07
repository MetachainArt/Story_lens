"""Delete expired photo rows and their private local files."""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_templates import ImageGenerationJob
from app.models.edit_history import EditHistory
from app.models.photo import Photo
from app.core.upload_paths import resolve_upload_path
from app.services.media_cleanup import remove_photo_file, remove_photo_music, retry_pending_media_cleanup


logger = logging.getLogger(__name__)
APP_ROOT = Path(__file__).resolve().parents[2]
UPLOAD_ROOT = (APP_ROOT / "uploads").resolve()


def _local_upload_path(url: str | None, owner_id: UUID) -> Path | None:
    return resolve_upload_path(APP_ROOT, url, photo_owner=owner_id)


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
    photo_files = {
        (url, photo.user_id)
        for photo in photos
        for url in (
            photo.original_url,
            photo.edited_url,
            photo.thumbnail_url,
        )
        if url is not None
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

    for photo_id in photo_ids:
        remove_photo_music(APP_ROOT, photo_id)

    for url, owner_id in photo_files:
        remove_photo_file(APP_ROOT, url, owner_id)
    return len(photos)


async def purge_all_expired_photos(db: AsyncSession, batch_size: int = 200) -> int:
    retry_pending_media_cleanup(APP_ROOT)
    total = 0
    while True:
        purged = await purge_expired_photo_batch(db, batch_size=batch_size)
        total += purged
        if purged < batch_size:
            return total
