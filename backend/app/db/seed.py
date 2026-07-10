"""Explicit first-teacher bootstrap command.

No default credentials are embedded. Set all ``INITIAL_TEACHER_*`` variables
and run ``python -m app.db.seed`` only when provisioning a new installation.
"""

import asyncio
import os

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.schemas.auth import validate_password


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} must be set explicitly")
    return value


async def create_seed_data() -> None:
    email = _required("INITIAL_TEACHER_EMAIL")
    name = _required("INITIAL_TEACHER_NAME")
    password = validate_password(_required("INITIAL_TEACHER_PASSWORD"))

    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == email))
        if existing:
            print(f"Teacher account already exists: {email}")
            return

        db.add(
            User(
                name=name,
                email=email,
                password_hash=get_password_hash(password),
                role="teacher",
                is_active=True,
            )
        )
        await db.commit()
        print(f"Teacher account created: {email}")


if __name__ == "__main__":
    asyncio.run(create_seed_data())
