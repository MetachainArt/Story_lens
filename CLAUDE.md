# Story Lens - CLAUDE.md

## Project Info
- **Name**: Story Lens (스토리 렌즈)
- **Purpose**: Photo editing app for people with disabilities
- **Tech Stack**: FastAPI + React 19 + PostgreSQL

## Development Rules
- TDD: RED → GREEN → REFACTOR for all Phase 1+ tasks
- Git Worktree: Phase 1+ must use separate worktrees
- Domain-Guarded: Screens declare data needs, backend provides independently

## Architecture
- Backend: `backend/` - FastAPI + SQLAlchemy 2.0 (async) + Alembic
- Frontend: `frontend/` - React 19 + Vite + TailwindCSS + Zustand
- Database: PostgreSQL 16 (Docker) - `story_lens` DB

## Conventions
- Backend routes: `backend/app/routes/{resource}.py`
- Backend models: `backend/app/models/{model}.py`
- Frontend pages: `frontend/src/pages/{screen}/index.tsx`
- Frontend components: `frontend/src/components/{category}/{Component}.tsx`

## Lessons Learned

### [2026-02-09] PostgreSQL Connection Issues with asyncpg from Windows Host (asyncpg, PostgreSQL, Docker, Windows)
- **상황**: Alembic 마이그레이션 실행 시 asyncpg로 PostgreSQL Docker 컨테이너 연결 시도
- **문제**: `password authentication failed for user "postgres"` 에러 발생. Docker 내부에서는 정상 작동하지만 Windows 호스트에서는 연결 실패
- **원인**: Windows 환경에서 asyncpg가 localhost 연결 시 IPv6 (::1)를 우선 시도하여 인증 실패. PostgreSQL Docker 컨테이너의 pg_hba.conf 설정 문제
- **해결**:
  1. Alembic env.py를 동기 연결(psycopg2)로 변경하여 마이그레이션 생성
  2. psycopg2-binary 설치
  3. 최종적으로 Docker exec를 통해 직접 SQL 실행으로 테이블 생성
- **교훈**:
  - Docker PostgreSQL 사용 시 Windows 호스트에서 asyncpg 연결 문제 발생 가능
  - Alembic은 동기 연결(psycopg2) 사용 권장
  - 개발 환경에서는 Docker exec로 직접 SQL 실행이 더 안정적일 수 있음

### [2026-02-09] Pydantic Settings extra fields 에러 (Pydantic, Settings, env)
- **상황**: Alembic env.py 로드 시 Pydantic Settings 초기화
- **문제**: `.env` 파일에 POSTGRES_USER, POSTGRES_PASSWORD 등이 있지만 Settings 클래스에 정의되지 않아 ValidationError 발생
- **원인**: Pydantic v2는 기본적으로 extra fields를 금지 (extra="forbid")
- **해결**: Settings.Config에 `extra = "ignore"` 추가
- **교훈**: Pydantic Settings 사용 시 .env 파일의 모든 변수를 Settings 클래스에 정의하거나 extra="ignore" 설정 필요

### [2026-02-09] passlib과 bcrypt 5.0 호환성 문제 (passlib, bcrypt, compatibility)
- **상황**: 시드 데이터 생성 시 패스워드 해시 생성
- **문제**: `AttributeError: module 'bcrypt' has no attribute '__about__'` 및 `ValueError: password cannot be longer than 72 bytes` 에러
- **원인**: passlib 1.7.4가 bcrypt 5.0.0과 호환되지 않음
- **해결**: bcrypt를 4.3.0으로 다운그레이드 (`pip install "bcrypt<5.0.0"`)
- **교훈**: passlib 사용 시 bcrypt는 4.x 버전 사용 권장. requirements.txt에 `bcrypt<5.0.0` 명시 필요
