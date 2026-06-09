"""Simple child-friendly safety screening for template image generation."""

from dataclasses import dataclass
import logging
import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.ai_templates import SafetyEvent


SOFT_BLOCK_MESSAGE = "이 주제는 사용할 수 없어요. 다른 예쁜 주제로 바꿔볼까요?"
logger = logging.getLogger(__name__)

_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("violence", re.compile(r"kill|blood|gun|weapon|murder|폭력|피|총|칼|죽", re.I)),
    ("scary", re.compile(r"horror|ghost|demon|무서|귀신|악마|공포", re.I)),
    ("sexual", re.compile(r"nude|sexy|sexual|선정|과한\s*노출|노골적|야한", re.I)),
    ("hate", re.compile(r"hate|racist|차별|혐오|비하", re.I)),
    ("dangerous_action", re.compile(r"self harm|suicide|폭탄|마약|자해|위험한 행동", re.I)),
    ("private_info", re.compile(r"\b\d{2,3}-\d{3,4}-\d{4}\b|\b\d{6}-\d{7}\b|주소|전화번호|주민등록", re.I)),
    ("famous_character", re.compile(r"pikachu|pokemon|disney|mickey|elsa|pororo|뽀로로|피카츄|디즈니|엘사", re.I)),
    ("impersonation", re.compile(r"as real person|pretend to be|사칭|실존 인물처럼|유명인처럼", re.I)),
]


@dataclass(frozen=True)
class SafetyResult:
    allowed: bool
    reason: str = ""
    message: str = SOFT_BLOCK_MESSAGE


def screen_prompt(text: str, extra_terms: list[str] | None = None) -> SafetyResult:
    haystack = text.strip()
    if not haystack:
        return SafetyResult(True)

    safe_haystack = haystack.replace("이중노출", "이중 이미지 효과")

    for reason, pattern in _RULES:
        if pattern.search(safe_haystack):
            return SafetyResult(False, reason=reason)

    for term in extra_terms or []:
        clean = term.strip()
        if clean == "노출":
            if re.search(r"(?<!이중)노출", safe_haystack, re.I):
                return SafetyResult(False, reason="template_negative_term")
            continue
        if clean and clean.lower() in safe_haystack.lower():
            return SafetyResult(False, reason="template_negative_term")

    return SafetyResult(True)


async def record_safety_event(
    db: AsyncSession,
    *,
    user_id: UUID | None,
    template_id: UUID | None,
    reason: str,
    input_text: str,
) -> None:
    db.add(
        SafetyEvent(
            user_id=user_id,
            template_id=template_id,
            reason=reason,
            input_text=input_text[:4000],
            metadata_json={},
        )
    )
    await db.commit()
