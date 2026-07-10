"""Content-based image validation tests."""

from io import BytesIO

import pytest
from PIL import Image

from app.services.image_validation import (
    ImageValidationError,
    validate_image_bytes,
)


def _image_bytes(image_format: str = "PNG", size: tuple[int, int] = (8, 6)) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, (120, 180, 220)).save(output, format=image_format)
    return output.getvalue()


def test_valid_image_uses_decoded_format_metadata():
    result = validate_image_bytes(
        _image_bytes("PNG"),
        declared_mime="image/png",
    )

    assert result.mime_type == "image/png"
    assert result.extension == ".png"
    assert (result.width, result.height) == (8, 6)


def test_fake_image_is_rejected_even_with_image_mime():
    with pytest.raises(ImageValidationError, match="올바르지 않은 이미지"):
        validate_image_bytes(b"not really a jpeg", declared_mime="image/jpeg")


def test_declared_mime_must_match_decoded_format():
    with pytest.raises(ImageValidationError, match="일치하지 않아요"):
        validate_image_bytes(_image_bytes("PNG"), declared_mime="image/jpeg")


def test_pixel_limit_is_enforced_before_storage():
    with pytest.raises(ImageValidationError, match="해상도가 너무 커요"):
        validate_image_bytes(_image_bytes(size=(20, 20)), max_pixels=100)
