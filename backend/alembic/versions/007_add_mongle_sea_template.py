"""Add Mongle Sea reference-person poster template.

Revision ID: 007
Revises: 006
Create Date: 2026-06-09 14:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CATEGORY_ID = "2c85b784-1601-43b2-a822-1306f66ddbd4"
TEMPLATE_ID = "d8d02ad7-2a39-4760-9eb0-52cae3f31369"
VERSION_ID = "19b076b3-03d0-46c5-9ac2-54ee0a894763"

MONGLE_SEA_PROMPT = """[참조 인물]
첨부한 인물 사진을 참조하여, 사진 속 인물의 얼굴 특징, 눈매, 표정 분위기, 헤어스타일, 전체적인 인상을 자연스럽게 반영한다. 인물의 정체성은 유지하되, 전체 분위기는 귀엽고 사랑스러운 한국형 여름 이야기 감성으로 표현한다.

[메인 장면]
인물은 알록달록한 수영 고글을 착용하고, 자신의 키보다 훨씬 큰 거대한 캐릭터 버블 배스 병 안에 신나게 앉아 있다. 병의 크기는 인물의 약 3배 높이로 보이게 연출하고, 장면 전체는 밝고 유쾌한 어린이 목욕 제품 광고 포스터처럼 구성한다.

[캐릭터 병 디자인]
병 자체를 귀엽고 개성 있는 바다 캐릭터 테마로 변경한다. 병은 "아기 해달 캐릭터" 또는 "말랑한 바다 생물 캐릭터"처럼 보이는 사랑스러운 실루엣으로 디자인하고, 반짝이는 플라스틱 재질과 투명한 바디, 귀여운 라벨 디테일을 강조한다.

[장난감 소품]
주변에는 작은 아기 해달 장난감, 파란 돌고래, 말랑한 문어, 고래 장난감, 조개 물총, 수박 튜브, 별 모양 욕실 장난감이 풍성한 거품 사이에 둥둥 떠다니도록 연출한다. 전체 소품은 귀엽고 컬러풀하며, 한국 여름 동화 같은 분위기를 강화한다.

[거품 연출]
병에서는 무지개빛 비눗방울, 파스텔 톤 거품, 몽글몽글한 흰 거품, 반짝이는 레인보우 폼이 풍성하게 넘쳐흐르며 화면 전체를 화사하고 신나는 분위기로 채운다.

[제품명 텍스트]
병 전면에는 큰 둥근 한글 글씨로 "몽글바다"를 넣는다. 글씨는 밝은 하늘색과 햇살 같은 노란색 조합의 통통 튀는 입체 타이포그래피로 표현하고, 실제 병 라벨에 인쇄된 것처럼 자연스럽게 배치한다.

[배경]
배경은 밝은 파스텔 블루 톤의 깨끗한 한국 가정집 욕실로 설정한다. 부드러운 여름 햇살이 창문으로 들어오고, 욕실 타일과 물방울, 욕조 주변에는 따뜻한 반사광이 맺히며, 전체적으로 포근하고 청량한 여름 무드를 만든다.

[배경 타이포그래피]
배경에도 큰 둥근 한글 타이포그래피 "몽글바다"를 반복적으로 배치하여 광고 포스터처럼 경쾌하고 리드미컬한 시각 효과를 만든다. 텍스트는 밝은 파랑과 노랑 계열로 통일하고, 장면과 자연스럽게 어우러지게 한다.

[태그라인]
하단에는 "목욕 시간이 여름 바다처럼 신나졌어요."라는 문구를 넣고, 친근하고 귀여운 둥근 한글 글씨체로 인쇄된 포스터 문구처럼 표현한다.

[스타일]
포토리얼 기반의 귀엽고 프리미엄한 어린이 목욕 제품 광고 비주얼, 한국 여름 동화 감성, 밝고 부드러운 욕실 조명, 실제 같은 피부 질감, 반짝이는 플라스틱 재질, 풍성한 거품 표현, 안전하고 가족 친화적인 분위기, 사랑스러운 캐릭터 장난감, 고해상도 세로형 광고 포스터 디자인."""


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO categories (id, name, slug, kind, description, sort_order, is_active, created_at, updated_at)
            VALUES (:category_id, '어린이 광고 포스터', 'kids-ad-poster', 'template', '사진 속 인물을 광고 포스터처럼 바꾸는 카드예요.', 0, true, now(), now())
            ON CONFLICT (slug) DO UPDATE
            SET name = EXCLUDED.name,
                kind = EXCLUDED.kind,
                description = EXCLUDED.description,
                is_active = true,
                updated_at = now()
            """
        ),
        {"category_id": CATEGORY_ID},
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO prompt_templates (
                id, category_id, name, description, thumbnail_url, base_prompt,
                variables, default_values, negative_terms, recommended_age, locale_labels,
                is_public, is_active, is_recommended, usage_count, example_image_url, created_at, updated_at
            )
            SELECT
                :template_id,
                (SELECT id FROM categories WHERE slug = 'kids-ad-poster' LIMIT 1),
                '아이가 여름 바다 목욕놀이 포스터 만들기',
                '사진 속 인물을 몽글바다 여름 목욕 제품 광고 포스터처럼 바꿔요.',
                '',
                :prompt,
                '[]'::jsonb,
                '{}'::jsonb,
                '["폭력", "무서운", "선정적", "개인정보", "유명 캐릭터"]'::jsonb,
                '전체',
                '{}'::jsonb,
                true,
                true,
                true,
                0,
                '',
                now(),
                now()
            WHERE NOT EXISTS (
                SELECT 1 FROM prompt_templates WHERE name = '아이가 여름 바다 목욕놀이 포스터 만들기'
            )
            """
        ),
        {"template_id": TEMPLATE_ID, "prompt": MONGLE_SEA_PROMPT},
    )

    bind.execute(
        sa.text(
            """
            UPDATE prompt_templates
            SET category_id = (SELECT id FROM categories WHERE slug = 'kids-ad-poster' LIMIT 1),
                description = '사진 속 인물을 몽글바다 여름 목욕 제품 광고 포스터처럼 바꿔요.',
                base_prompt = :prompt,
                variables = '[]'::jsonb,
                default_values = '{}'::jsonb,
                is_public = true,
                is_active = true,
                is_recommended = true,
                updated_at = now()
            WHERE name = '아이가 여름 바다 목욕놀이 포스터 만들기'
            """
        ),
        {"prompt": MONGLE_SEA_PROMPT},
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO prompt_template_versions (
                id, template_id, version_number, base_prompt, variables, default_values, negative_terms, created_at
            )
            SELECT
                :version_id,
                id,
                1,
                :prompt,
                '[]'::jsonb,
                '{}'::jsonb,
                '["폭력", "무서운", "선정적", "개인정보", "유명 캐릭터"]'::jsonb,
                now()
            FROM prompt_templates
            WHERE name = '아이가 여름 바다 목욕놀이 포스터 만들기'
              AND NOT EXISTS (
                  SELECT 1 FROM prompt_template_versions
                  WHERE template_id = prompt_templates.id
              )
            """
        ),
        {"version_id": VERSION_ID, "prompt": MONGLE_SEA_PROMPT},
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("DELETE FROM prompt_templates WHERE name = '아이가 여름 바다 목욕놀이 포스터 만들기'")
    )
