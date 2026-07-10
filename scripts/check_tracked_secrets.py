"""Fail CI when staged/tracked files contain likely production secrets."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "Google API key": re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    "OpenAI-style API key": re.compile(r"\bsk-[0-9A-Za-z_-]{20,}"),
    "assigned application secret": re.compile(
        r"(?im)^[ \t]*(?:KIE_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|SECRET_KEY)"
        r"[ \t]*=[ \t]*[\"']?([^\"'#\s]+)"
    ),
    "credentialed external PostgreSQL URL": re.compile(
        r"postgresql(?:\+asyncpg)?://[^:\s]+:([^@\s]+)@([^/\s]+)",
        re.IGNORECASE,
    ),
}
PLACEHOLDERS = (
    "change_me",
    "changeme",
    "change-in-production",
    "ci-only",
    "<",
    "example",
    "test-password",
)


def _candidate_files() -> list[str]:
    output = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"]
    )
    return [item.decode("utf-8", "surrogateescape") for item in output.split(b"\0") if item]


def _content(path: str) -> str | None:
    try:
        data = Path(path).read_bytes()
    except OSError:
        return None
    if b"\0" in data:
        return None
    return data.decode("utf-8", "ignore")


def main() -> int:
    findings: list[str] = []
    for path in _candidate_files():
        content = _content(path)
        if content is None:
            continue
        for label, pattern in PATTERNS.items():
            for match in pattern.finditer(content):
                if label == "assigned application secret":
                    value = match.group(1).lower()
                    if any(marker in value for marker in PLACEHOLDERS):
                        continue
                if label == "credentialed external PostgreSQL URL":
                    password = match.group(1).lower()
                    host = match.group(2).split(":", 1)[0].lower()
                    if host in {"localhost", "127.0.0.1", "db"}:
                        continue
                    if any(marker in password for marker in PLACEHOLDERS):
                        continue
                line = content.count("\n", 0, match.start()) + 1
                findings.append(f"{path}:{line}: possible {label}")

    if findings:
        print("Potential secrets found in tracked files:", file=sys.stderr)
        print("\n".join(findings), file=sys.stderr)
        return 1
    print("No tracked production-secret patterns found")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
