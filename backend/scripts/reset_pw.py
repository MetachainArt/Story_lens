"""Dev utility: reset/create a user's password.

Reads the database URL and target credentials from environment variables so no
secrets are ever hardcoded. Run from the backend directory, e.g.:

    DATABASE_URL=postgresql+asyncpg://... \
    RESET_EMAIL=teacher@example.com \
    RESET_PASSWORD=... \
    python scripts/reset_pw.py
"""
import asyncio
import os
import sys
import traceback
from uuid import uuid4

from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return value


async def reset_password() -> None:
    database_url = _require_env("DATABASE_URL")
    email = _require_env("RESET_EMAIL")
    password = _require_env("RESET_PASSWORD")
    name = os.environ.get("RESET_NAME", "테스트 선생님")
    role = os.environ.get("RESET_ROLE", "teacher")

    engine = create_async_engine(database_url)
    try:
        pw = pwd_context.hash(password)
        async with engine.begin() as conn:
            res = await conn.execute(
                text("SELECT id FROM users WHERE email=:email"), {"email": email}
            )
            user = res.fetchone()
            if not user:
                print("User does not exist, creating new one...")
                await conn.execute(
                    text(
                        """
                        INSERT INTO users (id, name, email, password_hash, role, is_active)
                        VALUES (:id, :name, :email, :pw, :role, true)
                        """
                    ),
                    {"id": str(uuid4()), "name": name, "email": email, "pw": pw, "role": role},
                )
            else:
                print("User exists, updating password...")
                await conn.execute(
                    text("UPDATE users SET password_hash=:pw WHERE email=:email"),
                    {"pw": pw, "email": email},
                )
            print(f"Successfully updated/created {email}")
    except Exception:
        print("Error details:")
        traceback.print_exc()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_password())
