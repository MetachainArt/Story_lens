# Architecture Decisions

## 2026-02-06: Tech Stack Selection
- **Decision**: FastAPI + React + PostgreSQL
- **Reason**: Teacher already knows Supabase (PostgreSQL), Python is accessible for L2 user

## 2026-02-06: Image Processing
- **Decision**: Browser-side Canvas API (not server-side)
- **Reason**: Real-time preview, reduced server load, works offline

## 2026-02-06: Auth Strategy
- **Decision**: Teacher-managed accounts with JWT
- **Reason**: Students with disabilities shouldn't manage their own accounts
