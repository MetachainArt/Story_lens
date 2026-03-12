"""Test configuration and fixtures."""
import pytest
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker, AsyncEngine
from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.user import User
from app.core.security import get_password_hash

# Test database URL - using PostgreSQL test database
TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/story_lens_test"


@pytest.fixture(scope="function")
async def test_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create test engine for each test."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=None,  # Use NullPool to avoid connection pool issues
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
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False
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
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def test_teacher(db_session: AsyncSession) -> User:
    """Create a test teacher user."""
    teacher = User(
        name="테스트 선생님",
        email="teacher@storylens.com",
        password_hash=get_password_hash("password123"),
        role="teacher",
        is_active=True
    )
    db_session.add(teacher)
    await db_session.commit()
    await db_session.refresh(teacher)
    return teacher


@pytest.fixture(scope="function")
async def test_student(db_session: AsyncSession, test_teacher: User) -> User:
    """Create a test student user."""
    student = User(
        name="테스트 학생",
        email="student1@storylens.com",
        password_hash=get_password_hash("password123"),
        role="student",
        teacher_id=test_teacher.id,
        is_active=True
    )
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


@pytest.fixture(scope="function")
async def teacher_token(test_teacher: User) -> str:
    """Create access token for test teacher."""
    from app.core.security import create_access_token
    return create_access_token(subject=str(test_teacher.id))


@pytest.fixture(scope="function")
async def student_token(test_student: User) -> str:
    """Create access token for test student."""
    from app.core.security import create_access_token
    return create_access_token(subject=str(test_student.id))
