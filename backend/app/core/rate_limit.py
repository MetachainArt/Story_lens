"""Database-backed rate limiting for expensive endpoints."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.api_rate_limit import ApiRateLimit as _ApiRateLimit

_ = _ApiRateLimit


def _extract_bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() == "bearer" and token:
        return token
    return None


def _client_key(request: Request) -> str:
    token = (
        request.cookies.get("access_token")
        or request.cookies.get("refresh_token")
        or _extract_bearer_token(request)
    )
    if token:
        try:
            payload = decode_token(token)
            sub = payload.get("sub")
            if sub:
                return f"user:{sub}"
        except ValueError:
            pass

    real_ip = request.headers.get("x-real-ip", "").strip()
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[-1].strip()
    client_host = real_ip or forwarded_for or (
        request.client.host if request.client else "unknown"
    )
    return f"ip:{client_host}"


def _bucket_key(
    request: Request,
    window_seconds: int,
    scope: str | None = None,
    identity: str | None = None,
) -> str:
    bucket_scope = scope or request.url.path
    subject = (
        f"identity:{identity.strip().lower()}"
        if identity and identity.strip()
        else _client_key(request)
    )
    raw_key = f"{bucket_scope}|{window_seconds}|{subject}"
    digest = sha256(raw_key.encode("utf-8")).hexdigest()
    return f"rl:{digest}"


def _retry_after_seconds(window_seconds: int, window_start: datetime) -> int:
    if window_start.tzinfo is None:
        window_start = window_start.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - window_start).total_seconds()
    return max(1, int(window_seconds - elapsed))


async def enforce_rate_limit(
    db: AsyncSession,
    request: Request,
    max_calls: int,
    window_seconds: float,
    *,
    scope: str | None = None,
    identity: str | None = None,
) -> None:
    """Consume one shared fixed-window bucket.

    An optional identity protects one login account independently without
    blocking a classroom whose devices share the same public IP address.
    """
    window = int(window_seconds)
    if max_calls < 1 or window < 1:
        raise ValueError("Rate limit values must be positive integers")

    now = datetime.now(timezone.utc)
    result = await db.execute(
        text(
            """
            INSERT INTO api_rate_limits (
                bucket_key,
                window_start,
                window_seconds,
                request_count,
                updated_at
            )
            VALUES (:bucket_key, :now, :window_seconds, 1, :now)
            ON CONFLICT (bucket_key) DO UPDATE SET
                window_start = CASE
                    WHEN api_rate_limits.window_start <=
                        (:now - (:window_seconds * INTERVAL '1 second'))
                    THEN :now
                    ELSE api_rate_limits.window_start
                END,
                request_count = CASE
                    WHEN api_rate_limits.window_start <=
                        (:now - (:window_seconds * INTERVAL '1 second'))
                    THEN 1
                    ELSE api_rate_limits.request_count + 1
                END,
                window_seconds = :window_seconds,
                updated_at = :now
            RETURNING request_count, window_start
            """
        ),
        {
            "bucket_key": _bucket_key(request, window, scope, identity),
            "now": now,
            "window_seconds": window,
        },
    )
    row = result.one()._mapping
    await db.commit()

    request_count = int(row["request_count"])
    if request_count > max_calls:
        retry_after = _retry_after_seconds(window, row["window_start"])
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
            headers={"Retry-After": str(retry_after)},
        )


def rate_limit(
    max_calls: int,
    window_seconds: float,
    *,
    scope: str | None = None,
) -> Callable[..., None]:
    """Return a FastAPI dependency enforcing a fixed-window request limit.

    The bucket is stored in PostgreSQL so limits work across Uvicorn workers and
    Docker restarts. This is intended for cost-bearing endpoints such as AI
    generation, STT, and music generation.
    """

    window = int(window_seconds)
    if max_calls < 1 or window < 1:
        raise ValueError("Rate limit values must be positive integers")

    async def _dependency(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ) -> None:
        await enforce_rate_limit(
            db,
            request,
            max_calls,
            window,
            scope=scope,
        )

    return _dependency


async def purge_stale_rate_limits(db: AsyncSession) -> int:
    """Remove inactive buckets so attacker-supplied login identities cannot grow forever."""
    cutoff = datetime.now(timezone.utc) - timedelta(
        days=max(1, settings.RATE_LIMIT_RETENTION_DAYS)
    )
    result = await db.execute(
        delete(_ApiRateLimit)
        .where(_ApiRateLimit.updated_at < cutoff)
        .returning(_ApiRateLimit.bucket_key)
    )
    deleted_keys = list(result.scalars())
    await db.commit()
    return len(deleted_keys)
