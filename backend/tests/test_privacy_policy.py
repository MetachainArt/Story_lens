"""Photo consent and retention policy tests."""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.privacy import (
    has_current_photo_consent,
    photo_retention_values,
    require_photo_processing_consent,
)


def _user(consented: bool, version: str | None = None):
    return SimpleNamespace(
        privacy_consent_at=datetime.now(timezone.utc) if consented else None,
        privacy_policy_version=version,
    )


def test_current_policy_consent_is_accepted():
    user = _user(True, settings.PRIVACY_POLICY_VERSION)
    assert has_current_photo_consent(user) is True
    require_photo_processing_consent(user)


def test_old_or_missing_consent_is_rejected():
    for user in (_user(False), _user(True, "old-policy")):
        with pytest.raises(HTTPException) as exc_info:
            require_photo_processing_consent(user)
        assert exc_info.value.status_code == 428
        assert exc_info.value.detail["code"] == "privacy_consent_required"


def test_new_photos_receive_retention_snapshot():
    expires_at, days = photo_retention_values()
    assert days == settings.PHOTO_RETENTION_DAYS
    assert expires_at is not None
    assert expires_at > datetime.now(timezone.utc)
