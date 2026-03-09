import importlib
from logging.config import fileConfig
from sqlalchemy import pool, engine_from_config
from sqlalchemy.engine import Connection
from sqlalchemy.engine import make_url
from alembic import context

Base = importlib.import_module("app.db.base").Base
settings = importlib.import_module("app.core.config").settings

# Import models for side effects so they are registered in metadata
importlib.import_module("app.models")

config = context.config

# Convert async URL to sync URL for Alembic (psycopg2)
async_url = make_url(settings.DATABASE_URL)
query = dict(async_url.query)

# Normalize SSL options for libpq drivers
sslmode = query.get("sslmode")
ssl = query.get("ssl")
if not sslmode:
    if isinstance(ssl, str) and ssl:
        query["sslmode"] = ssl
    else:
        environment = settings.ENVIRONMENT.lower()
        hostname = (async_url.host or "").lower()
        if environment in {"prod", "production"} and hostname not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            query["sslmode"] = "require"

sync_url = async_url.set(drivername="postgresql+psycopg2", query=query)
sync_url_string = sync_url.render_as_string(hide_password=False).replace("%", "%%")
config.set_main_option(
    "sqlalchemy.url",
    sync_url_string,
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode using sync connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
