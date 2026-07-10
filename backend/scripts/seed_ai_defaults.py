"""Idempotently install built-in AI templates, assets, and presets."""

import asyncio
import logging

from app.db.session import AsyncSessionLocal
from app.services.ai_defaults import ensure_ai_defaults


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await ensure_ai_defaults(db)
    logging.getLogger(__name__).info("AI defaults are up to date")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
