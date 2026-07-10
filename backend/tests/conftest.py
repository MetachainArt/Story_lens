"""Test configuration and fixtures."""

import os
import importlib
from datetime import datetime, timezone
from collections.abc import AsyncGenerator
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
    AsyncEngine,
)
from sqlalchemy.pool import NullPool

app = importlib.import_module("app.main").app
Base = importlib.import_module("app.db.base").Base
get_db = importlib.import_module("app.db.session").get_db
UserModel = importlib.import_module("app.models.user").User
SessionModel = importlib.import_module("app.models.session").Session
PhotoModel = importlib.import_module("app.models.photo").Photo
security_module = importlib.import_module("app.core.security")
settings = importlib.import_module("app.core.config").settings
is_local_database_url = importlib.import_module(
    "app.core.config"
)._is_local_database_url
get_password_hash = security_module.get_password_hash
create_access_token = security_module.create_access_token


def _read_test_database_url() -> str | None:
    explicit_test_url = os.getenv("TEST_DATABASE_URL")
    if explicit_test_url:
        return explicit_test_url.strip().strip('"').strip("'")

    env_path = Path(__file__).resolve().parents[1] / ".env.test"
    if not env_path.exists():
        return None

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == "TEST_DATABASE_URL":
            candidate = value.strip().strip('"').strip("'")
            if candidate and "<" not in candidate and ">" not in candidate:
                return candidate
    return None


def _resolve_test_database_url() -> str | None:
    explicit_test_url = _read_test_database_url()
    if not explicit_test_url:
        return None

    if explicit_test_url == settings.DATABASE_URL:
        raise RuntimeError(
            "TEST_DATABASE_URL must be different from DATABASE_URL to prevent destructive test writes."
        )

    parsed_test = urlparse(explicit_test_url)
    parsed_main = urlparse(settings.DATABASE_URL)

    if parsed_test.scheme != "postgresql+asyncpg":
        raise RuntimeError("TEST_DATABASE_URL must use postgresql+asyncpg scheme.")

    if is_local_database_url(explicit_test_url):
        test_database = (parsed_test.path or "").lstrip("/").lower()
        if not test_database.endswith("_test"):
            raise RuntimeError(
                "A local TEST_DATABASE_URL is allowed only when its database name "
                "ends with '_test'."
            )
        return explicit_test_url

    test_host = (parsed_test.hostname or "").lower()
    main_host = (parsed_main.hostname or "").lower()
    test_user = (parsed_test.username or "").lower()
    main_user = (parsed_main.username or "").lower()

    if test_host == main_host and test_user == main_user:
        raise RuntimeError(
            "TEST_DATABASE_URL must point to a different project/user than DATABASE_URL. "
            "For Supabase pooler, keep host same only if username differs (for example, postgres.<project_ref>)."
        )

    return explicit_test_url


TEST_DATABASE_URL: str | None = _resolve_test_database_url()


def _build_test_engine_config() -> tuple[str, dict[str, object]]:
    if not TEST_DATABASE_URL:
        raise RuntimeError("A dedicated TEST_DATABASE_URL is required for DB tests.")
    url = make_url(TEST_DATABASE_URL)
    query = dict(url.query)
    connect_args: dict[str, object] = {}

    sslmode = query.pop("sslmode", None)
    if sslmode:
        connect_args["ssl"] = False if str(sslmode).lower() == "disable" else "require"
        url = url.set(query=query)

    hostname = (url.host or "").lower()
    if hostname.endswith("pooler.supabase.com"):
        connect_args["statement_cache_size"] = 0
        connect_args["prepared_statement_name_func"] = (
            lambda: f"__asyncpg_test_{uuid4().hex}__"
        )

    return url.render_as_string(hide_password=False), connect_args


@pytest.fixture(scope="function")
async def test_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create test engine for each test."""
    if not TEST_DATABASE_URL:
        pytest.skip(
            "DB integration test skipped: configure a dedicated TEST_DATABASE_URL."
        )
    engine_url, connect_args = _build_test_engine_config()
    engine = create_async_engine(
        engine_url,
        connect_args=connect_args,
        echo=False,
        poolclass=NullPool,
    )
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    # Create tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Create session maker
    TestSessionLocal = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    # Create session
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()

    # Drop tables after test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with overridden database dependency."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def test_teacher(db_session: AsyncSession):
    """Create a test teacher user."""
    teacher = UserModel(
        name="테스트 선생님",
        email="teacher@storylens.com",
        password_hash=get_password_hash("password123"),
        role="teacher",
        is_active=True,
        privacy_consent_at=datetime.now(timezone.utc),
        privacy_policy_version=settings.PRIVACY_POLICY_VERSION,
    )
    db_session.add(teacher)
    await db_session.commit()
    await db_session.refresh(teacher)
    return teacher


@pytest.fixture(scope="function")
async def test_student(db_session: AsyncSession, test_teacher):
    """Create a test student user."""
    student = UserModel(
        name="테스트 학생",
        email="student1@storylens.com",
        password_hash=get_password_hash("password123"),
        role="student",
        teacher_id=test_teacher.id,
        is_active=True,
        privacy_consent_at=datetime.now(timezone.utc),
        privacy_policy_version=settings.PRIVACY_POLICY_VERSION,
    )
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


@pytest.fixture(scope="function")
async def teacher_token(test_teacher) -> str:
    """Create access token for test teacher."""
    return create_access_token(subject=str(test_teacher.id))


@pytest.fixture(scope="function")
async def student_token(test_student) -> str:
    """Create access token for test student."""
    return create_access_token(subject=str(test_student.id))


@pytest.fixture(scope="function")
async def test_session(db_session: AsyncSession, test_student):
    """Create a test session for photos."""
    from datetime import date

    session = SessionModel(
        user_id=test_student.id, date=date.today(), title="테스트 촬영 세션"
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session


@pytest.fixture(scope="function")
async def test_photo(db_session: AsyncSession, test_student, test_session):
    """Create a test photo."""

    photo = PhotoModel(
        user_id=test_student.id,
        session_id=test_session.id,
        original_url="https://example.com/photo1.jpg",
        title="테스트 사진",
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)
    return photo
