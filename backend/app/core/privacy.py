"""Photo-processing consent and retention policy helpers."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.core.config import settings
from app.models.user import User


def has_current_photo_consent(user: User) -> bool:
    return bool(
        user.privacy_consent_at
        and user.privacy_policy_version == settings.PRIVACY_POLICY_VERSION
    )


def require_photo_processing_consent(user: User) -> None:
    if has_current_photo_consent(user):
        return
    raise HTTPException(
        status_code=status.HTTP_428_PRECONDITION_REQUIRED,
        detail={
            "code": "privacy_consent_required",
            "message": "사진 저장과 AI 처리를 계속하려면 개인정보 안내에 동의해 주세요.",
        },
    )


def photo_retention_values() -> tuple[datetime | None, int | None]:
    days = settings.PHOTO_RETENTION_DAYS
    if days <= 0:
        return None, None
    return datetime.now(timezone.utc) + timedelta(days=days), days
