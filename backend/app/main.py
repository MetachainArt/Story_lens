"""FastAPI application with authentication."""

import logging
from urllib.parse import urlparse
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from .api.v1 import ai_templates, auth, users, sessions, filters
from .core.config import settings
from .routes import photos, edit_history, media, music, stt

logger = logging.getLogger(__name__)

app = FastAPI(title="API", version="0.1.0")
TEMPLATE_PREVIEWS_DIR = Path(__file__).resolve().parent / "static" / "template-previews"


def _expand_loopback_origin_aliases(origins_csv: str) -> list[str]:
    origins: set[str] = set()

    for origin in (item.strip() for item in origins_csv.split(",")):
        if not origin:
            continue

        origins.add(origin)
        parsed = urlparse(origin)
        host = (parsed.hostname or "").lower()

        if host not in {"localhost", "127.0.0.1"}:
            continue

        alias_host = "127.0.0.1" if host == "localhost" else "localhost"
        alias_netloc = f"{alias_host}:{parsed.port}" if parsed.port else alias_host
        alias_origin = f"{parsed.scheme}://{alias_netloc}"
        origins.add(alias_origin)

    return sorted(origins)


# GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS: restrict origins in production
allowed_origins = _expand_loopback_origin_aliases(settings.ALLOWED_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.mount("/template-previews", StaticFiles(directory=str(TEMPLATE_PREVIEWS_DIR)), name="template-previews")

# Include routers
# Auth router mounted at /api (as per TASKS.md spec)
app.include_router(auth.router, prefix="/api")
# Other routers use /api/v1
app.include_router(users.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(photos.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(filters.router, prefix="/api")
app.include_router(ai_templates.router, prefix="/api/v1")
app.include_router(ai_templates.admin_router, prefix="/api/v1")
# Edit history router (nested under /api)
app.include_router(edit_history.router, prefix="/api", tags=["edit_history"])
# Music generation router
app.include_router(music.router)
# STT (Speech-to-Text) router
app.include_router(stt.router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
