import base64
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException, status
from PIL import Image

from app.routes import photos as photos_route


def test_save_data_url_image_writes_file(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    user_id = uuid4()
    upload_dir = tmp_path / "uploads" / "photos"
    monkeypatch.setattr(photos_route, "UPLOAD_DIR", str(upload_dir))

    output = BytesIO()
    Image.new("RGB", (4, 3), (20, 40, 60)).save(output, format="JPEG")
    image_bytes = output.getvalue()
    encoded = base64.b64encode(image_bytes).decode("ascii")
    saved_url = photos_route._save_data_url_image(
        f"data:image/jpeg;base64,{encoded}", user_id
    )

    user_files = list((upload_dir / str(user_id)).glob("*.jpg"))
    assert len(user_files) == 1
    assert user_files[0].read_bytes() == image_bytes
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
