# @TASK P0-T0.2 - Database session configuration
# @SPEC docs/planning/04-database-design.md
"""Database session management for async SQLAlchemy."""

from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.engine import URL, make_url
from sqlalchemy.pool import NullPool

from ..core.config import settings


def _build_engine_config() -> tuple[URL, dict[str, object], bool]:
    url = make_url(settings.DATABASE_URL)
    if url.drivername in {"postgresql", "postgres"}:
        url = url.set(drivername="postgresql+asyncpg")

    query = dict(url.query)
    connect_args: dict[str, object] = {}
    use_null_pool = False

    # sslmode is a libpq/psycopg-style option and is not reliably supported by
    # asyncpg when passed as a query param. Translate it to asyncpg's ssl param.
    sslmode = query.pop("sslmode", None)
    if sslmode:
        connect_args["ssl"] = False if str(sslmode).lower() == "disable" else "require"
        url = url.set(query=query)
    else:
        environment = settings.ENVIRONMENT.lower()
        hostname = (url.host or "").lower()
        if environment in {"prod", "production"} and hostname not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            connect_args["ssl"] = "require"

    hostname = (url.host or "").lower()
    if hostname.endswith("pooler.supabase.com"):
        # Supabase transaction pooler (PgBouncer) is incompatible with
        # asyncpg's default prepared-statement behavior unless disabled.
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = (
            lambda: f"__asyncpg_{uuid4().hex}__"
        )
        use_null_pool = True

    return url, connect_args, use_null_pool


engine_url, engine_connect_args, use_null_pool = _build_engine_config()

# Create async engine
engine_options: dict[str, object] = {
    "connect_args": engine_connect_args,
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

if use_null_pool:
    engine_options["poolclass"] = NullPool
else:
    engine_options["pool_size"] = 10
    engine_options["max_overflow"] = 20
    engine_options["pool_recycle"] = 3600

engine = create_async_engine(engine_url, **engine_options)

# Create async session maker
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
