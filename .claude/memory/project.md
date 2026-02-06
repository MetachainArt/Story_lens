# Story Lens Project Memory

## Project Info
- Name: Story Lens (스토리 렌즈)
- Purpose: Simple photo editing app for people with disabilities
- Context: "꿈꾸는 카메라" program - monthly photography outings

## Tech Stack
- Frontend: React 19 + Vite 6 + TypeScript + TailwindCSS v4
- Backend: FastAPI (Python 3.11+) + SQLAlchemy 2.0 (async) + Alembic
- Database: PostgreSQL 15+
- Auth: JWT (access 15min, refresh 7d), teacher-managed accounts

## Architecture
- Web app (mobile + desktop browser)
- Image processing: browser-side (Canvas API)
- 7 screens: Login, Home, Camera, Select, Editor, Saved, Gallery
- 5 Emotion filters + 5 Adjustment sliders + Crop/Rotate

## Key Decisions
- Teacher creates student accounts (no self-registration)
- Min touch target: 48px (recommended 64px)
- Pretendard font
- Primary color: #FF6B35 (warm orange)
