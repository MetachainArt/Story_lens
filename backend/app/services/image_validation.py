"""Decode and validate image content before it enters private storage."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import warnings

from PIL import Image, UnidentifiedImageError

from app.core.config import settings


FORMAT_METADATA: dict[str, tuple[str, str]] = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "GIF": ("image/gif", ".gif"),
    "WEBP": ("image/webp", ".webp"),
}
MIME_ALIASES = {"image/jpg": "image/jpeg", "image/x-png": "image/png"}
MAX_ANIMATION_FRAMES = 100


class ImageValidationError(ValueError):
    """Raised when bytes are not a supported, safely bounded image."""


@dataclass(frozen=True)
class ValidatedImage:
    mime_type: str
    extension: str
    width: int
    height: int
    frame_count: int


def _inspect_image(
    source: BytesIO | Path,
    *,
    declared_mime: str | None,
    max_pixels: int,
) -> ValidatedImage:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(source) as image:
                image_format = str(image.format or "").upper()
                metadata = FORMAT_METADATA.get(image_format)
                if metadata is None:
                    raise ImageValidationError("지원하지 않는 이미지 형식이에요.")

                width, height = image.size
                if width <= 0 or height <= 0 or width * height > max_pixels:
                    raise ImageValidationError("이미지 해상도가 너무 커요.")

                frame_count = int(getattr(image, "n_frames", 1) or 1)
                if frame_count > MAX_ANIMATION_FRAMES:
                    raise ImageValidationError("프레임이 너무 많은 이미지는 사용할 수 없어요.")

                image.verify()
    except ImageValidationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ImageValidationError("이미지 해상도가 너무 커요.")
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise ImageValidationError("손상되었거나 올바르지 않은 이미지예요.")

    mime_type, extension = metadata
    normalized_declared = MIME_ALIASES.get(
        (declared_mime or "").split(";", 1)[0].strip().lower(),
        (declared_mime or "").split(";", 1)[0].strip().lower(),
    )
    if normalized_declared.startswith("image/") and normalized_declared != mime_type:
        raise ImageValidationError("파일 형식과 이미지 내용이 일치하지 않아요.")

    return ValidatedImage(
        mime_type=mime_type,
        extension=extension,
        width=width,
        height=height,
        frame_count=frame_count,
    )


def validate_image_bytes(
    data: bytes,
    *,
    declared_mime: str | None = None,
    max_bytes: int | None = None,
    max_pixels: int | None = None,
) -> ValidatedImage:
    byte_limit = max_bytes or settings.MAX_IMAGE_UPLOAD_BYTES
    if not data:
        raise ImageValidationError("비어 있는 이미지는 사용할 수 없어요.")
    if len(data) > byte_limit:
        raise ImageValidationError("이미지 파일이 너무 커요.")
    return _inspect_image(
        BytesIO(data),
        declared_mime=declared_mime,
        max_pixels=max_pixels or settings.MAX_IMAGE_PIXELS,
    )


def validate_image_file(
    path: str | Path,
    *,
    declared_mime: str | None = None,
    max_bytes: int | None = None,
    max_pixels: int | None = None,
) -> ValidatedImage:
    file_path = Path(path)
    try:
        size = file_path.stat().st_size
    except OSError:
        raise ImageValidationError("이미지 파일을 읽을 수 없어요.")
    if size <= 0:
        raise ImageValidationError("비어 있는 이미지는 사용할 수 없어요.")
    if size > (max_bytes or settings.MAX_IMAGE_UPLOAD_BYTES):
        raise ImageValidationError("이미지 파일이 너무 커요.")
    return _inspect_image(
        file_path,
        declared_mime=declared_mime,
        max_pixels=max_pixels or settings.MAX_IMAGE_PIXELS,
    )
