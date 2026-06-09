"""Update default AI template direction toward reference photos.

Revision ID: 006
Revises: 005
Create Date: 2026-06-09 14:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PROMPT = (
    "Turn the person in the uploaded reference photo into a {style} image set in {background}. "
    "Keep the same person's identity and friendly features, with a {mood} feeling. "
    "어린이가 좋아할 안전하고 밝은 이미지. "
    "부드러운 색감, 친절한 표정, 복잡하지 않은 구도. "
    "{text_option}"
)

OLD_PROMPT = (
    "{subject}이(가) {background}에서 보내는 {mood} 시간. "
    "{style} 스타일, 어린이가 좋아할 안전하고 밝은 이미지. "
    "부드러운 색감, 친절한 표정, 복잡하지 않은 구도. "
    "{text_option}"
)


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
        UPDATE prompt_templates
        SET
            name = '인물 동화 변신',
            description = '사진 속 인물을 유지하면서 따뜻한 동화 장면으로 바꿔요.',
            base_prompt = :new_prompt,
            updated_at = now()
        WHERE name = '상상 동화 장면'
          AND base_prompt = :old_prompt
        """
        ),
        {"new_prompt": NEW_PROMPT, "old_prompt": OLD_PROMPT},
    )

    bind.execute(
        sa.text(
            """
        UPDATE prompt_template_versions
        SET base_prompt = :new_prompt
        WHERE base_prompt = :old_prompt
        """
        ),
        {"new_prompt": NEW_PROMPT, "old_prompt": OLD_PROMPT},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
        UPDATE prompt_templates
        SET
            name = '상상 동화 장면',
            description = '주인공과 배경만 고르면 따뜻한 동화 장면을 만들어요.',
            base_prompt = :old_prompt,
            updated_at = now()
        WHERE name = '인물 동화 변신'
          AND base_prompt = :new_prompt
        """
        ),
        {"new_prompt": NEW_PROMPT, "old_prompt": OLD_PROMPT},
    )

    bind.execute(
        sa.text(
            """
        UPDATE prompt_template_versions
        SET base_prompt = :old_prompt
        WHERE base_prompt = :new_prompt
        """
        ),
        {"new_prompt": NEW_PROMPT, "old_prompt": OLD_PROMPT},
    )
