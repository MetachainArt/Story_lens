from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException, status

from app.routes import photos as photos_route


def test_save_data_url_image_writes_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    user_id = uuid4()
    upload_dir = tmp_path / "uploads" / "photos"
    monkeypatch.setattr(photos_route, "UPLOAD_DIR", str(upload_dir))

    saved_url = photos_route._save_data_url_image(
        "data:image/jpeg;base64,ZmFrZS1pbWFnZS1ieXRlcw==",
        user_id,
    )

    user_files = list((upload_dir / str(user_id)).glob("*.jpg"))
    assert len(user_files) == 1
    assert user_files[0].read_bytes() == b"fake-image-bytes"
    assert saved_url.startswith(f"/uploads/photos/{user_id}/")
    assert saved_url.endswith(".jpg")


def test_save_data_url_image_rejects_non_image_data(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(
        photos_route, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos")
    )

    with pytest.raises(HTTPException) as exc_info:
        photos_route._save_data_url_image(
            "data:text/plain;base64,ZmFrZS10ZXh0",
            uuid4(),
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert exc_info.value.detail == "Invalid edited_url"


def test_save_data_url_image_rejects_invalid_base64(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(
        photos_route, "UPLOAD_DIR", str(tmp_path / "uploads" / "photos")
    )

    with pytest.raises(HTTPException) as exc_info:
        photos_route._save_data_url_image(
            "data:image/png;base64,@@not-base64@@",
            uuid4(),
        )

    assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
    assert exc_info.value.detail == "Invalid edited_url"
