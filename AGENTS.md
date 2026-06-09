# Story Lens - AGENTS.md

## Project Info
- **Name**: Story Lens
- **Purpose**: Photo editing app for people with disabilities
- **Tech Stack**: FastAPI + React 19 + PostgreSQL

## Production / Server Notes
- Production backend server IP: `158.180.75.224`
- The backend is hosted on an Oracle/OCI server.
- Do not confuse "Oracle server" with "Oracle Database"; the app stack currently uses PostgreSQL.
- The backend and database are likely running in Docker on `158.180.75.224`.
- For frontend production builds, set `VITE_API_URL` to the public backend origin.
- Current production API origin: `https://api.storylens.dmssolution.co.kr`
- The backend itself is proxied from host Nginx to Docker on `127.0.0.1:8000`.

## Development Rules
- TDD: RED -> GREEN -> REFACTOR for all Phase 1+ tasks
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

### [2026-02-09] PostgreSQL Connection Issues with asyncpg from Windows Host
- Docker PostgreSQL from Windows host can fail when asyncpg tries IPv6 localhost first.
- Alembic may be more stable with psycopg2 sync connection in local development.
- For local Docker troubleshooting, direct `docker exec` SQL execution can be more reliable.

### [2026-02-09] Pydantic Settings extra fields
- Pydantic v2 settings rejects unknown env fields by default.
- Use `extra="ignore"` when `.env` contains deployment variables not represented in Settings.

### [2026-02-09] passlib and bcrypt 5.0 compatibility
- passlib 1.7.4 is not compatible with bcrypt 5.x.
- Keep `bcrypt==4.3.0` or another bcrypt 4.x pin when using passlib.
