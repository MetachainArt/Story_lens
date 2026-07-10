"""One-shot expired-photo cleanup for the retention worker."""

import asyncio
import logging

from app.core.rate_limit import purge_stale_rate_limits
from app.db.session import AsyncSessionLocal
from app.services.photo_retention import purge_all_expired_photos


async def main() -> None:
    async with AsyncSessionLocal() as db:
        purged = await purge_all_expired_photos(db)
        purged_rate_limits = await purge_stale_rate_limits(db)
    logging.getLogger(__name__).info("Purged %s expired photos", purged)
    logging.getLogger(__name__).info(
        "Purged %s stale rate-limit buckets",
        purged_rate_limits,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
