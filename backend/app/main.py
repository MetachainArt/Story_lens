"""FastAPI application with authentication."""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import auth, users, sessions, filters
from app.core.config import settings
from app.routes import photos, edit_history

logger = logging.getLogger(__name__)

app = FastAPI(title="API", version="0.1.0")

# Mount static files for uploads
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
if settings.DEBUG:
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS: restrict origins in production
allowed_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include routers
# Auth router mounted at /api (as per TASKS.md spec)
app.include_router(auth.router, prefix="/api")
# Other routers use /api/v1
app.include_router(users.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(photos.router, prefix="/api/v1")
app.include_router(filters.router, prefix="/api")
# Edit history router (nested under /api)
app.include_router(edit_history.router, prefix="/api", tags=["edit_history"])


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
