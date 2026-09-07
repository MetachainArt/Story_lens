"""Resolve private uploads once, using the same path for access and cleanup."""
from pathlib import Path
from uuid import UUID


def resolve_upload_path(
    app_root: Path, url: str | None, *, photo_owner: UUID | None = None
) -> Path | None:
    if not url:
        return None
    normalized = url.strip().lstrip("/")
    parts = normalized.split("/")
    # No decoding here: URL routing decodes once. Ambiguous stored paths fail closed.
    if (
        len(parts) != 4
        or parts[0] != "uploads"
        or parts[1] not in {"photos", "music"}
        or any(part in {"", ".", ".."} for part in parts)
        or any(char in normalized for char in ("\\", "%", ":", "?", "#", "\x00"))
    ):
        return None
    try:
        scope_id = UUID(parts[2])
        if str(scope_id) != parts[2]:
            return None
        if photo_owner is not None and (parts[1] != "photos" or scope_id != photo_owner):
            return None
        root = app_root.resolve()
        expected = root.joinpath(*parts)
        resolved = expected.resolve()
        # Reject symlink/junction aliases too, rather than trusting their prefix.
        if resolved != expected or not resolved.is_relative_to(root / "uploads"):
            return None
        return resolved
    except (OSError, ValueError, RuntimeError):
        return None
