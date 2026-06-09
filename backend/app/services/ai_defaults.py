"""Default AI template data for first-run development and demos."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.ai_templates import AdjustmentPreset, Category, CreativeAsset, PromptTemplate, PromptTemplateVersion


DEFAULT_VARIABLES = [
    {
        "key": "subject",
        "label": "주인공",
        "input_type": "choice",
        "choices": ["아이", "친구", "귀여운 캐릭터", "우리 가족", "상상 속 친구"],
        "default_value": "귀여운 캐릭터",
        "required": True,
    },
    {
        "key": "style",
        "label": "그림 스타일",
        "input_type": "choice",
        "choices": ["동화풍", "스티커풍", "포토카드", "필름 사진", "광고 포스터"],
        "default_value": "동화풍",
        "required": True,
    },
    {
        "key": "mood",
        "label": "분위기",
        "input_type": "choice",
        "choices": ["밝고 신나는", "따뜻한", "반짝이는", "차분한", "귀여운"],
        "default_value": "밝고 신나는",
        "required": True,
    },
    {
        "key": "background",
        "label": "배경",
        "input_type": "choice",
        "choices": ["여름 바닷가", "숲속", "교실", "하늘 정원", "생일 파티"],
        "default_value": "숲속",
        "required": True,
    },
    {
        "key": "text_option",
        "label": "넣을 문구",
        "input_type": "text",
        "choices": [],
        "default_value": "",
        "required": False,
    },
]


async def ensure_ai_defaults(db: AsyncSession) -> None:
    existing = await db.execute(select(Category).limit(1))
    if existing.scalar_one_or_none() is not None:
        return

    categories = [
        Category(name="동화풍 이미지", slug="fairy-tale", kind="template", sort_order=1),
        Category(name="귀여운 캐릭터", slug="cute-character", kind="template", sort_order=2),
        Category(name="포토카드", slug="photo-card", kind="template", sort_order=3),
        Category(name="프레임", slug="frames", kind="asset", sort_order=1),
        Category(name="스티커", slug="stickers", kind="asset", sort_order=2),
        Category(name="이모티콘", slug="emojis", kind="asset", sort_order=3),
    ]
    db.add_all(categories)
    await db.flush()

    template = PromptTemplate(
        category_id=categories[0].id,
        name="인물 동화 변신",
        description="사진 속 인물을 유지하면서 따뜻한 동화 장면으로 바꿔요.",
        thumbnail_url="",
        base_prompt=(
            "Turn the person in the uploaded reference photo into a {style} image set in {background}. "
            "Keep the same person's identity and friendly features, with a {mood} feeling. "
            "어린이가 좋아할 안전하고 밝은 이미지. "
            "부드러운 색감, 친절한 표정, 복잡하지 않은 구도. "
            "{text_option}"
        ),
        variables=DEFAULT_VARIABLES,
        default_values={item["key"]: item.get("default_value", "") for item in DEFAULT_VARIABLES},
        negative_terms=["폭력", "무서운", "선정적", "개인정보", "유명 캐릭터"],
        recommended_age="전체",
        is_recommended=True,
        example_image_url="",
    )
    db.add(template)
    await db.flush()
    db.add(
        PromptTemplateVersion(
            template_id=template.id,
            version_number=1,
            base_prompt=template.base_prompt,
            variables=template.variables,
            default_values=template.default_values,
            negative_terms=template.negative_terms,
        )
    )

    db.add_all(
        [
            CreativeAsset(
                asset_type="frame",
                name="polaroid",
                label="폴라로이드",
                payload={"borderColor": "#FFFDF8", "shadow": True},
                sort_order=1,
            ),
            CreativeAsset(
                asset_type="frame",
                name="storybook",
                label="동화 테두리",
                payload={"borderColor": "#F2B8A2", "radius": 24},
                sort_order=2,
            ),
            CreativeAsset(
                asset_type="sticker",
                name="heart",
                label="하트",
                payload={"text": "♥", "color": "#F472B6"},
                sort_order=1,
            ),
            CreativeAsset(
                asset_type="sticker",
                name="star",
                label="별",
                payload={"text": "★", "color": "#FACC15"},
                sort_order=2,
            ),
            CreativeAsset(asset_type="emoji", name="smile", label="웃음", payload={"text": "☺"}, sort_order=1),
            CreativeAsset(asset_type="emoji", name="cheer", label="응원", payload={"text": "파이팅"}, sort_order=2),
        ]
    )
    db.add_all(
        [
            AdjustmentPreset(name="warm", label="따뜻함", css_filter="brightness(1.1) saturate(1.25) sepia(0.18)", sort_order=1),
            AdjustmentPreset(name="cool", label="시원함", css_filter="brightness(1.05) saturate(0.92) hue-rotate(12deg)", sort_order=2),
            AdjustmentPreset(name="happy", label="화사함", css_filter="brightness(1.18) saturate(1.35) contrast(1.06)", sort_order=3),
            AdjustmentPreset(name="soft-film", label="필름", css_filter="brightness(1.04) saturate(0.82) sepia(0.22) contrast(0.94)", sort_order=4),
        ]
    )
    await db.commit()
