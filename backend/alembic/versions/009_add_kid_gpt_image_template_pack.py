"""Add kid-friendly GPT Image 2 template card pack.

Revision ID: 009
Revises: 008
Create Date: 2026-06-09 18:10:00.000000

"""

from __future__ import annotations

import json
from typing import Sequence, Union
from uuid import NAMESPACE_URL, uuid5

from alembic import op
import sqlalchemy as sa


revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PROMPT_STYLE_NOTE = (
    "Use the uploaded reference photo as the main person reference. Preserve the same person's facial identity, "
    "eyes, expression, hairstyle, age impression, and warm personality. Change only the costume, background, "
    "lighting, illustration finish, poster layout, and decorative elements requested below. Keep the result safe, "
    "family friendly, bright, non-scary, non-sexual, and suitable for children. Do not imitate famous copyrighted "
    "characters, celebrities, or brand mascots. Avoid extra text unless the scene explicitly asks for short Korean typography."
)


def _uuid(name: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"storylens-ai-template-pack:{name}"))


def _prompt(scene: str, style: str, details: str, composition: str = "high-quality vertical image") -> str:
    return f"""[Reference Person]
{PROMPT_STYLE_NOTE}

[Scene]
{scene}

[Visual Direction]
{style}

[Details]
{details}

[Composition]
{composition}, clear main subject, polished lighting, coherent background, charming child-friendly mood, high resolution."""


CATEGORIES = [
    ("story-adventure-play", "상상 놀이 모험", "사진 속 인물을 재미있는 놀이 모험 장면으로 바꾸는 카드", 1),
    ("season-festival-play", "계절·축제 놀이", "계절과 기념일 분위기로 아이들이 즐겁게 쓰는 카드", 2),
    ("poster-card-studio", "포스터·카드 스튜디오", "광고 포스터, 포토카드, 표지처럼 만드는 카드", 3),
    ("sticker-emoji-maker", "스티커·이모티콘", "프로필, 스티커, 이모티콘 느낌의 귀여운 카드", 4),
    ("learning-world-tour", "탐험·직업 체험", "교실·진로·과학 탐험처럼 배움과 놀이를 함께 담는 카드", 5),
]


TEMPLATES = [
    # 상상 놀이 모험
    ("story-adventure-play", "구름 위 작은 비행선 여행", _prompt(
        "The person rides a tiny pastel airship above fluffy clouds, waving happily while soft sunlight glows through the sky.",
        "Whimsical Korean storybook illustration mixed with gentle photoreal skin texture, pastel sky, warm rim light.",
        "Add small cloud houses, ribbon flags, star-shaped balloons, and a soft blue horizon. Keep the face recognizable and joyful.",
    ), "3:4"),
    ("story-adventure-play", "장난감 기차 숲속 모험", _prompt(
        "The person sits in a colorful toy train traveling through a friendly miniature forest made of paper trees and tiny lanterns.",
        "Premium children storybook poster, tactile paper craft textures, warm green and yellow lighting.",
        "Include acorn stations, mushroom benches, tiny signposts without readable brand names, and soft sparkles.",
    ), "3:4"),
    ("story-adventure-play", "달빛 도서관 탐험", _prompt(
        "The person explores a cozy moonlit library where books float gently and safe glowing constellations appear above the shelves.",
        "Dreamy fantasy library, soft cinematic light, rich blues and golds, magical but not scary.",
        "Add ladders, open picture books, friendly paper stars, and a calm wonder-filled expression.",
    ), "3:4"),
    ("story-adventure-play", "비눗방울 우주 산책", _prompt(
        "The person floats inside a transparent rainbow soap bubble through a playful outer-space scene.",
        "Cute premium sci-fi for children, glossy bubbles, pastel planets, safe family-friendly space adventure.",
        "Add smiling star stickers, cotton-candy nebula colors, small toy rockets, and soft reflections on the bubble.",
    ), "3:4"),
    ("story-adventure-play", "과자 집 마을 산책", _prompt(
        "The person walks through a tiny sweet village made of cookies, fruit jelly windows, and cream-colored paths.",
        "Bright storybook food fantasy, appetizing but clean, pastel bakery colors, soft depth of field.",
        "Keep all food decorative and safe-looking. Add tiny flags, candy flowers, and a cozy afternoon mood.",
    ), "3:4"),
    ("story-adventure-play", "종이배 바다 탐험", _prompt(
        "The person rides a large folded paper boat across a gentle indoor sea made of sparkling blue paper waves.",
        "Korean summer storybook style, handcrafted paper set, cheerful sea colors, warm sunlight.",
        "Add shell toys, small friendly fish shapes, origami birds, and a sense of safe playful adventure.",
    ), "3:4"),
    ("story-adventure-play", "숲속 작은 요정 정원", _prompt(
        "The person becomes the guest of a tiny fairy garden filled with glowing flowers and miniature tea tables.",
        "Soft fantasy garden, natural skin texture, warm bokeh lights, non-copyright original fairy tale design.",
        "Add dewdrops, flower lanterns, small handmade chairs, and gentle smile. No wings are required unless natural.",
    ), "3:4"),
    ("story-adventure-play", "풍선 열기구 피크닉", _prompt(
        "The person enjoys a sky picnic in a round balloon hot-air basket floating over a colorful park.",
        "Sunny children's magazine cover, playful shapes, warm orange and sky-blue palette, polished poster look.",
        "Add picnic basket, paper bunting, safe toy binoculars, and soft clouds behind the person.",
    ), "3:4"),
    ("story-adventure-play", "거대한 꽃잎 미끄럼틀", _prompt(
        "The person plays on a giant flower petal slide in a bright garden playground.",
        "Cute photoreal fantasy playground, macro flower world, soft sunlight, family-friendly joy.",
        "Add ladybug-shaped cushions, leaf umbrellas, colorful pollen sparkles, and a safe playful pose.",
    ), "3:4"),
    ("story-adventure-play", "무지개 비밀문 앞에서", _prompt(
        "The person stands in front of a glowing rainbow door that opens to a gentle magical playground.",
        "Premium fairytale portrait, pastel rainbow lighting, soft fog-free glow, clean composition.",
        "Add key-shaped charm, small lanterns, floating ribbons, and a curious happy expression.",
    ), "3:4"),

    # 계절·축제 놀이
    ("season-festival-play", "여름 수박 수영장 포스터", _prompt(
        "The person sits beside a cute watermelon-shaped kiddie pool with colorful goggles and summer toys.",
        "Bright Korean summer ad-poster mood, photoreal skin, glossy toy textures, fresh blue and red colors.",
        "Add water droplets, inflatable rings, fruit-shaped toys, and cheerful sunlight. Keep everything modest and child-safe.",
    ), "3:4"),
    ("season-festival-play", "봄 벚꽃 소풍 카드", _prompt(
        "The person enjoys a gentle spring picnic under soft cherry blossoms in a clean park.",
        "Pastel spring photo card, airy sunlight, soft pink petals, warm family album feeling.",
        "Add picnic mat, small flower crown prop, paper cups, and floating petals without clutter.",
    ), "3:4"),
    ("season-festival-play", "가을 낙엽 탐정 놀이", _prompt(
        "The person becomes a friendly leaf detective looking for colorful autumn leaves with a toy magnifier.",
        "Cozy autumn storybook poster, warm brown, amber, and cream colors, soft natural lighting.",
        "Add acorns, leaf map, small notebook, and playful mystery mood without scary elements.",
    ), "3:4"),
    ("season-festival-play", "겨울 눈꽃 쿠키 가게", _prompt(
        "The person stands in a cozy winter cookie shop decorated with snowflake ornaments and warm lights.",
        "Cute winter bakery poster, soft cream and blue palette, gentle indoor glow, premium children's illustration.",
        "Add cookie trays, mittens, snowflake stickers on windows, and a happy welcoming pose.",
    ), "3:4"),
    ("season-festival-play", "생일 케이크 무대", _prompt(
        "The person is on a small birthday stage with a giant pastel cake backdrop and safe confetti.",
        "Festive birthday poster, bright but elegant, soft studio lighting, rounded shapes.",
        "Add balloons, wrapped gifts, star garlands, and a clean empty area for optional future text.",
    ), "3:4"),
    ("season-festival-play", "어린이날 놀이공원 티켓", _prompt(
        "The person appears as the hero of a cheerful children's day amusement park ticket poster.",
        "Colorful poster-card design, friendly rides in the background, clean Korean editorial layout without real logos.",
        "Add carousel horses as original toy designs, cotton candy colors, and a big joyful atmosphere.",
    ), "3:4"),
    ("season-festival-play", "비 오는 날 장화 산책", _prompt(
        "The person walks through a bright rainy-day street wearing cute rain gear, stepping near safe puddles.",
        "Soft cinematic rainy-day photo illustration, reflective puddles, pastel umbrellas, cozy mood.",
        "Add frog-shaped umbrella patterns, raindrop sparkles, and warm window lights. No storm or danger.",
    ), "3:4"),
    ("season-festival-play", "한여름 아이스크림 트럭", _prompt(
        "The person stands beside a colorful original ice cream truck in a sunny neighborhood park.",
        "Premium summer commercial poster, clean product-like styling, glossy pastel surfaces, bright daylight.",
        "Add popsicle decorations, small menu shapes without readable prices, and cheerful summer breeze.",
    ), "3:4"),
    ("season-festival-play", "추석 달토끼 마당", _prompt(
        "The person enjoys a gentle Korean holiday moonlit yard with round rice cakes and lanterns.",
        "Warm Korean folktale mood, soft moonlight, traditional-but-modern family-friendly visual.",
        "Add original rabbit lantern props, woven baskets, paper moons, and calm festive happiness.",
    ), "3:4"),
    ("season-festival-play", "크리스마스 장난감 공방", _prompt(
        "The person visits a cozy Christmas toy workshop filled with handmade wooden toys and warm lights.",
        "Soft holiday storybook style, red, green, gold accents, premium cozy lighting.",
        "Avoid Santa or copyrighted characters. Add ribbons, toy blocks, stars, and a safe magical workshop feeling.",
    ), "3:4"),

    # 포스터·카드 스튜디오
    ("poster-card-studio", "몽글바다 목욕놀이 광고", _prompt(
        "The person sits cheerfully inside a giant cute sea-creature bubble bath bottle called 몽글바다.",
        "Photoreal premium children's bath product ad poster, bright Korean summer bathroom, sparkling plastic and bubbles.",
        "Add otter-like original toys, dolphin toys, shells, rainbow foam, round Korean typography 몽글바다 on the bottle label.",
        "vertical commercial poster, clear product focus",
    ), "3:4"),
    ("poster-card-studio", "과일 주스 광고 모델", _prompt(
        "The person becomes the friendly model of a colorful fruit juice poster with oversized fruit props.",
        "Clean studio advertising poster, glossy fruit, bright background, natural skin, playful Korean commercial tone.",
        "Add orange slices, strawberry shapes, transparent cup props, and fresh splash effects without mess.",
    ), "3:4"),
    ("poster-card-studio", "나만의 잡지 표지", _prompt(
        "The person appears on a stylish kids magazine cover about imagination and play.",
        "Editorial cover design, clean layout, soft studio portrait, modern pastel background.",
        "Add abstract shapes, small decorative headline blocks with no required readable text, polished magazine feel.",
    ), "3:4"),
    ("poster-card-studio", "영화 예고 포스터", _prompt(
        "The person is the main hero of a cheerful adventure movie poster set in a bright friendly town.",
        "Family adventure movie poster, cinematic but light, no danger, warm heroic lighting.",
        "Add original toy-like side props, glowing path, soft clouds, and dynamic safe pose.",
    ), "3:4"),
    ("poster-card-studio", "스포츠 응원 포토카드", _prompt(
        "The person appears as a cheerful sports supporter on a collectible photo card.",
        "Clean sports card design, energetic colors, studio lighting, no real team logos.",
        "Add flags, confetti, number shapes, and a bold card frame with original graphic elements.",
    ), "4:5"),
    ("poster-card-studio", "꿈 발표회 무대 포스터", _prompt(
        "The person stands on a small school presentation stage with a bright dream-show backdrop.",
        "Warm school event poster, friendly spotlight, neat stage, colorful paper decorations.",
        "Add stars, curtains, handmade signs with no mandatory text, and confident happy expression.",
    ), "3:4"),
    ("poster-card-studio", "도서관 독서왕 포스터", _prompt(
        "The person becomes the star of a reading campaign poster in a cozy library corner.",
        "Clean educational poster, warm lamp light, books, soft colors, inviting atmosphere.",
        "Add open books, bookmark ribbons, gentle sparkle, and optional empty banner space.",
    ), "3:4"),
    ("poster-card-studio", "환경 지킴이 포스터", _prompt(
        "The person appears as a friendly earth helper watering a small plant in a bright garden.",
        "Cute eco campaign poster, clean green and sky-blue palette, soft realistic light.",
        "Add recycling-style abstract icons without brand marks, sprouts, watering can, and hopeful mood.",
    ), "3:4"),
    ("poster-card-studio", "우주 과학 포스터", _prompt(
        "The person is featured in a cheerful space science poster beside a toy telescope and pastel planets.",
        "Educational science poster, clean typography area, blue-violet space colors, non-scary wonder.",
        "Add orbit lines, star stickers, rocket toys, and soft classroom-lab details.",
    ), "3:4"),
    ("poster-card-studio", "카페 디저트 메뉴 포스터", _prompt(
        "The person poses beside a cute dessert display in a bright family cafe poster.",
        "Premium cafe ad visual, warm beige, mint, and coral colors, soft natural light.",
        "Add cupcakes, fruit tart props, menu board shapes without prices, and cheerful clean styling.",
    ), "3:4"),

    # 스티커·이모티콘
    ("sticker-emoji-maker", "동글 얼굴 스티커 세트", _prompt(
        "Transform the person into a cute round-face sticker character while preserving recognizable facial features.",
        "Clean sticker design, white or transparent-feeling background, thick soft outline, bright friendly colors.",
        "Make one main sticker pose with sparkles and a cheerful expression. No text.",
    ), "1:1"),
    ("sticker-emoji-maker", "응원 이모티콘", _prompt(
        "Create a cheerful encouragement emoticon of the person holding small pom-poms.",
        "Korean messenger emoticon style, rounded shape, simple readable silhouette, soft outline.",
        "Add stars and motion lines. Leave space where short text can be added later, but do not create text now.",
    ), "1:1"),
    ("sticker-emoji-maker", "하트 뿅 스티커", _prompt(
        "Create a cute heart-themed sticker of the person smiling warmly with small floating hearts.",
        "Glossy sticker illustration, rounded face, preserved identity, pastel pink and coral accents.",
        "Keep it wholesome and friendly, one centered character, no brand or celebrity style.",
    ), "1:1"),
    ("sticker-emoji-maker", "놀람 표정 이모티콘", _prompt(
        "Create a playful surprised emoticon of the person with wide eyes and safe cartoon shock lines.",
        "Cute messenger sticker, clean outline, bright yellow and blue accents, expressive but gentle.",
        "Add small exclamation shapes without readable text. Keep the face recognizable.",
    ), "1:1"),
    ("sticker-emoji-maker", "생일 축하 스티커", _prompt(
        "Create a birthday celebration sticker of the person wearing a small party hat.",
        "Colorful sticker illustration, confetti, balloons, cake icon props, thick rounded border.",
        "No readable text, no copyrighted characters, cheerful and family friendly.",
    ), "1:1"),
    ("sticker-emoji-maker", "반짝 프로필 아이콘", _prompt(
        "Create a polished circular profile icon of the person with soft sparkles around the face.",
        "Premium cute avatar, clean circular composition, pastel gradient background, natural identity cues.",
        "Keep hairstyle and facial impression from the reference photo. No text.",
    ), "1:1"),
    ("sticker-emoji-maker", "동물 후드 캐릭터", _prompt(
        "Create a cute original animal-hood sticker version of the person, using a generic bear or bunny hood design.",
        "Soft plush hoodie, rounded sticker art, warm eyes, preserved facial identity, child-friendly charm.",
        "Do not imitate existing characters. Add tiny paw or ear details as original design.",
    ), "1:1"),
    ("sticker-emoji-maker", "브이 포즈 포토 스티커", _prompt(
        "Create a photo-booth sticker of the person making a friendly V-sign pose.",
        "Korean photo sticker style, glossy border, small decorative icons, bright studio lighting.",
        "Add stars, hearts, and tape-like frame decorations, with no required readable text.",
    ), "1:1"),
    ("sticker-emoji-maker", "잠자는 구름 이모티콘", _prompt(
        "Create a cozy sleepy emoticon of the person resting on a fluffy cloud pillow.",
        "Soft sticker art, pastel lavender and cream colors, gentle sleepy expression, rounded outline.",
        "No scary night mood. Add tiny moon and star props, no text.",
    ), "1:1"),
    ("sticker-emoji-maker", "최고야 엄지척 스티커", _prompt(
        "Create a positive thumbs-up sticker of the person smiling with confidence.",
        "Clean messenger sticker, bright blue and yellow accents, bold friendly pose, thick white outline.",
        "Keep the person recognizable and wholesome. No text.",
    ), "1:1"),

    # 탐험·직업 체험
    ("learning-world-tour", "꼬마 과학자 실험실", _prompt(
        "The person becomes a cheerful young scientist in a safe colorful classroom lab.",
        "Educational poster, clean lab table, pastel science props, realistic face with playful illustration finish.",
        "Add beakers with colored water, magnifying glass, star charts, and no hazardous chemicals.",
    ), "3:4"),
    ("learning-world-tour", "우주비행사 훈련소", _prompt(
        "The person wears an original friendly astronaut training suit in a bright space classroom.",
        "Cute science museum poster, soft white and blue suit, pastel planets, safe futuristic room.",
        "Add control panels with abstract shapes, toy rockets, and floating star stickers.",
    ), "3:4"),
    ("learning-world-tour", "정원사 꽃 연구소", _prompt(
        "The person becomes a kind garden researcher caring for colorful flowers in a greenhouse.",
        "Warm educational nature poster, green sunlight, plant labels without readable brand text, cozy atmosphere.",
        "Add watering can, seed packets, butterflies as simple original props, and gentle smile.",
    ), "3:4"),
    ("learning-world-tour", "미니 셰프 쿠킹 클래스", _prompt(
        "The person becomes a friendly cooking class chef decorating fruit pancakes in a bright kitchen.",
        "Clean family cooking poster, warm kitchen light, colorful fruit, safe child-friendly cooking props.",
        "Add apron, mixing bowl, berries, and no knives or dangerous tools.",
    ), "3:4"),
    ("learning-world-tour", "작은 건축가 도시 만들기", _prompt(
        "The person builds a miniature colorful city with blocks and paper houses on a classroom table.",
        "Creative learning poster, soft studio light, playful architecture model, clean composition.",
        "Add rulers, blocks, paper trees, and original tiny buildings without real logos.",
    ), "3:4"),
    ("learning-world-tour", "바다 생물 연구원", _prompt(
        "The person becomes a gentle ocean researcher observing cute sea-life toys in a bright aquarium classroom.",
        "Educational ocean poster, blue water glow, friendly original sea creatures, safe and calm.",
        "Add notebook, shell samples, toy submarine, and soft reflections.",
    ), "3:4"),
    ("learning-world-tour", "기상 캐스터 체험", _prompt(
        "The person appears as a cheerful weather presenter in front of a playful illustrated weather board.",
        "Kids broadcast poster, clean studio, sunny cloud icons, bright blue and yellow palette.",
        "Add umbrella, sun, cloud, and wind symbols as original graphics. No real broadcaster logo.",
    ), "3:4"),
    ("learning-world-tour", "박물관 시간 여행", _prompt(
        "The person explores a friendly museum exhibit with ancient pottery, maps, and soft golden lighting.",
        "Educational museum adventure, warm cinematic light, not scary, polished storybook realism.",
        "Add display cases, map scrolls, small lantern glow, and curious expression.",
    ), "3:4"),
    ("learning-world-tour", "음악 지휘자 무대", _prompt(
        "The person becomes a friendly music conductor on a small colorful classroom concert stage.",
        "Warm concert poster, toy instruments, soft spotlight, elegant but playful visual.",
        "Add music note decorations, small xylophone and drum props, no real orchestra logos.",
    ), "3:4"),
    ("learning-world-tour", "로봇 친구 만들기", _prompt(
        "The person builds a cute original robot friend from colorful blocks in a maker classroom.",
        "STEM learning poster, bright workspace, friendly toy robot design, polished illustration-realism blend.",
        "Add wires as safe decorative shapes, stickers, building blocks, and a proud happy pose.",
    ), "3:4"),
]


def upgrade() -> None:
    bind = op.get_bind()
    now = sa.text("now()")

    for slug, name, description, sort_order in CATEGORIES:
        bind.execute(
            sa.text(
                """
                INSERT INTO categories (id, name, slug, kind, description, sort_order, is_active, created_at, updated_at)
                VALUES (:id, :name, :slug, 'template', :description, :sort_order, true, now(), now())
                ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    kind = 'template',
                    sort_order = EXCLUDED.sort_order,
                    is_active = true,
                    updated_at = now()
                """
            ),
            {
                "id": _uuid(f"category:{slug}"),
                "name": name,
                "slug": slug,
                "description": description,
                "sort_order": sort_order,
            },
        )

    for index, (category_slug, name, base_prompt, aspect_ratio) in enumerate(TEMPLATES, start=1):
        template_id = _uuid(f"template:{category_slug}:{name}")
        version_id = _uuid(f"version:{category_slug}:{name}:1")
        bind.execute(
            sa.text(
                """
                INSERT INTO prompt_templates (
                    id, category_id, name, description, thumbnail_url, base_prompt,
                    variables, default_values, negative_terms, recommended_age, locale_labels,
                    requires_source_photo, aspect_ratio, visible_user_fields,
                    is_public, is_active, is_recommended, usage_count, example_image_url, created_at, updated_at
                )
                VALUES (
                    :template_id,
                    (SELECT id FROM categories WHERE slug = :category_slug LIMIT 1),
                    :name,
                    :description,
                    '',
                    :base_prompt,
                    CAST(:variables AS jsonb),
                    CAST(:default_values AS jsonb),
                    CAST(:negative_terms AS jsonb),
                    '전체',
                    CAST(:locale_labels AS jsonb),
                    true,
                    :aspect_ratio,
                    CAST(:visible_user_fields AS jsonb),
                    true,
                    true,
                    :is_recommended,
                    0,
                    '',
                    now(),
                    now()
                )
                ON CONFLICT (id) DO UPDATE
                SET category_id = EXCLUDED.category_id,
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    base_prompt = EXCLUDED.base_prompt,
                    variables = EXCLUDED.variables,
                    default_values = EXCLUDED.default_values,
                    negative_terms = EXCLUDED.negative_terms,
                    recommended_age = EXCLUDED.recommended_age,
                    locale_labels = EXCLUDED.locale_labels,
                    requires_source_photo = EXCLUDED.requires_source_photo,
                    aspect_ratio = EXCLUDED.aspect_ratio,
                    visible_user_fields = EXCLUDED.visible_user_fields,
                    is_public = true,
                    is_active = true,
                    is_recommended = EXCLUDED.is_recommended,
                    updated_at = now()
                """
            ),
            {
                "template_id": template_id,
                "category_slug": category_slug,
                "name": name,
                "description": "사진 한 장으로 바로 만들 수 있는 GPT Image 2 이미지 카드입니다.",
                "base_prompt": base_prompt,
                "variables": json.dumps([], ensure_ascii=False),
                "default_values": json.dumps({}, ensure_ascii=False),
                "negative_terms": json.dumps(["폭력", "무서운", "선정적", "개인정보", "유명 캐릭터", "사칭"], ensure_ascii=False),
                "locale_labels": json.dumps({}, ensure_ascii=False),
                "visible_user_fields": json.dumps([], ensure_ascii=False),
                "aspect_ratio": aspect_ratio,
                "is_recommended": index <= 10,
            },
        )
        bind.execute(
            sa.text(
                """
                INSERT INTO prompt_template_versions (
                    id, template_id, version_number, base_prompt, variables, default_values, negative_terms, created_at
                )
                VALUES (
                    :version_id,
                    :template_id,
                    1,
                    :base_prompt,
                    CAST(:variables AS jsonb),
                    CAST(:default_values AS jsonb),
                    CAST(:negative_terms AS jsonb),
                    now()
                )
                ON CONFLICT (id) DO UPDATE
                SET base_prompt = EXCLUDED.base_prompt,
                    variables = EXCLUDED.variables,
                    default_values = EXCLUDED.default_values,
                    negative_terms = EXCLUDED.negative_terms
                """
            ),
            {
                "version_id": version_id,
                "template_id": template_id,
                "base_prompt": base_prompt,
                "variables": json.dumps([], ensure_ascii=False),
                "default_values": json.dumps({}, ensure_ascii=False),
                "negative_terms": json.dumps(["폭력", "무서운", "선정적", "개인정보", "유명 캐릭터", "사칭"], ensure_ascii=False),
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    for category_slug, name, _prompt_text, _aspect_ratio in TEMPLATES:
        bind.execute(
            sa.text("DELETE FROM prompt_templates WHERE id = :template_id"),
            {"template_id": _uuid(f"template:{category_slug}:{name}")},
        )
    for slug, _name, _description, _sort_order in CATEGORIES:
        bind.execute(sa.text("DELETE FROM categories WHERE slug = :slug"), {"slug": slug})
