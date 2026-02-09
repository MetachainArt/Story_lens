"""FastAPI application with authentication."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1 import auth, users, sessions
from app.routes import photos
import os

app = FastAPI(title="API", version="0.1.0")

# Mount static files for uploads
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# Auth router mounted at /api (as per TASKS.md spec)
app.include_router(auth.router, prefix="/api")
# Other routers use /api/v1
app.include_router(users.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(photos.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
