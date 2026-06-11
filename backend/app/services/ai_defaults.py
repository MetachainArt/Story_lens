"""Default AI template data for first-run development and production fallback."""

from __future__ import annotations

from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.ai_templates import AdjustmentPreset, Category, CreativeAsset, PromptTemplate, PromptTemplateVersion


SAFE_NEGATIVE_TERMS = [
    "폭력",
    "무서운 표현",
    "선정적 표현",
    "차별",
    "개인정보",
    "위험 행동",
    "유명 캐릭터 복제",
    "실존 인물 사칭",
]

PROMPT_PREFIX = """[참조 인물]
첨부한 인물 사진을 주인공 참조로 사용한다. 사진 속 인물의 얼굴 특징, 눈매, 표정 분위기, 헤어스타일, 나이 인상, 전체적인 따뜻한 느낌을 자연스럽게 유지한다. 정체성은 유지하되 의상, 배경, 조명, 장식, 포스터 구성만 바꾼다.

[안전 기준]
어린이와 가족이 보기에 안전하고 밝은 분위기로 만든다. 무섭거나 폭력적이거나 선정적인 표현은 넣지 않는다. 특정 유명 캐릭터, 브랜드 마스코트, 연예인, 실존 인물 사칭처럼 보이게 만들지 않는다. 필요한 경우 짧고 둥근 한글 타이포그래피만 자연스럽게 넣는다.
"""


def _uuid(name: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"storylens-default-ai-pack:{name}")


def _preview_url(seed_slug: str) -> str:
    return f"/template-previews/{_uuid(f'template:{seed_slug}')}.png"


def _prompt(scene: str, style: str, details: str, composition: str) -> str:
    return f"""{PROMPT_PREFIX}

[메인 장면]
{scene}

[스타일]
{style}

[디테일]
{details}

[구도]
{composition}. 주인공이 명확히 보이고, 표정은 자연스럽고 사랑스럽게 유지한다. 고해상도 GPT Image 2 이미지, 밝고 세련된 완성도."""


KID_TEMPLATE_CATEGORIES = [
    ("story-adventure-play", "상상 모험", "사진 속 인물을 동화 같은 놀이 모험 장면으로 바꾸는 카드예요.", 10),
    ("season-festival-play", "계절·축제", "여름, 봄, 생일, 명절처럼 아이들이 좋아하는 계절 카드예요.", 20),
    ("poster-card-studio", "포스터·카드", "광고 포스터, 표지, 포토카드처럼 완성도 있게 만드는 카드예요.", 30),
    ("sticker-emoji-maker", "스티커·이모티콘", "프로필, 스티커, 이모티콘처럼 귀엽게 쓰는 카드예요.", 40),
    ("learning-world-tour", "직업·체험", "과학자, 요리사, 탐험가처럼 재미있는 체험 장면을 만드는 카드예요.", 50),
    ("magazine-style", "잡지 스타일", "표지, 화보, 에디토리얼처럼 세련된 잡지 컷을 만드는 카드예요.", 60),
    ("world-landmark-tour", "세계 주요 관광지", "세계의 유명 관광지를 배경으로 여행 사진처럼 만드는 카드예요.", 70),
    ("film-style", "필름 스타일", "따뜻한 필름 사진, 빈티지 감성, 시네마 무드로 만드는 카드예요.", 80),
]

RETOUCH_TEMPLATE_CATEGORIES = [
    ("ai-photo-retouch", "AI사진보정", "사진을 자연스럽게 보정하고 가족사진을 새롭게 만드는 카드예요.", 5),
]

RETOUCH_PROMPT_PREFIX = """[참조 사진 보정 기준]
업로드한 사진 속 인물의 정체성, 얼굴 특징, 표정, 헤어스타일, 옷차림의 핵심 인상은 유지한다. 결과는 가족이 보기에 자연스럽고 안전해야 하며, 과도한 신체 변형, 선정적인 연출, 유명인 사칭, 특정 캐릭터 복제는 하지 않는다.

[보정 안전 기준]
미성년자는 신체를 과장하거나 성적으로 보이게 만들지 않는다. 어르신 사진의 회춘은 자연스러운 생기, 피부톤, 조명 개선 중심으로 처리하고 완전히 다른 사람처럼 바꾸지 않는다. 배경 변경은 인물 경계와 조명을 자연스럽게 맞춘다.
"""


def _retouch_prompt(goal: str, details: str, output: str) -> str:
    return f"""{RETOUCH_PROMPT_PREFIX}

[보정 목표]
{goal}

[작업 지시]
{details}

[완성 형태]
{output}. 고해상도 GPT Image 2 image-to-image 결과, 자연스러운 피부 질감, 깨끗한 조명, 원본 인물 보존."""


RETOUCH_TEMPLATE_CARDS = [
    (
        "ai-photo-retouch",
        "키 늘리기",
        "전신 사진에서 인물의 얼굴과 옷차림은 유지하고 다리와 전체 비율을 자연스럽게 길어 보이게 보정한다.",
        "카메라 왜곡처럼 보이지 않게 배경 선과 바닥 원근을 자연스럽게 맞춘다. 과장된 신체 변형은 피하고 건강하고 세련된 프로필 사진 느낌으로 만든다.",
        "자연스러운 전신 보정 사진",
        "3:4",
        ["body_style"],
        {"body_style": "자연스럽게"},
    ),
    (
        "ai-photo-retouch",
        "얼굴 뽀샤시 보정",
        "배경과 얼굴형은 그대로 유지하고 얼굴을 밝고 부드럽게 보정한다.",
        "눈매와 얼굴 특징은 바꾸지 않는다. 피부톤은 맑게, 조명은 화사하게, 전체 인상은 자연스럽게 정리한다. 플라스틱 피부처럼 과하게 만들지 않는다.",
        "자연스러운 뽀샤시 얼굴 보정 사진",
        "4:3",
        ["skin_finish"],
        {"skin_finish": "뽀샤시하게"},
    ),
    (
        "ai-photo-retouch",
        "얼굴 잡티 제거",
        "배경과 인물의 얼굴형은 그대로 유지하고 잡티, 작은 피부 얼룩, 칙칙한 부분만 자연스럽게 줄인다.",
        "눈, 코, 입, 얼굴 윤곽, 점처럼 정체성을 나타내는 특징은 보존한다. 피부결은 남기고 과도한 블러 없이 깨끗한 인물 사진처럼 보정한다.",
        "잡티만 자연스럽게 정리된 얼굴 사진",
        "4:3",
        ["blemish_level"],
        {"blemish_level": "자연스럽게"},
    ),
    (
        "ai-photo-retouch",
        "회춘사진",
        "어르신 사진을 더 젊고 생기 있어 보이게 자연스럽게 보정한다.",
        "동일 인물로 알아볼 수 있게 얼굴 특징과 표정은 유지한다. 주름은 부드럽게 완화하고 피부톤, 머리 윤기, 조명을 밝게 개선하되 과도하게 어려 보이게 만들지 않는다.",
        "자연스러운 회춘 인물 사진",
        "3:4",
        ["youth_level"],
        {"youth_level": "자연스럽게"},
    ),
    (
        "ai-photo-retouch",
        "가족사진 배경 바꾸기",
        "가족 또는 단체사진의 인물들은 그대로 유지하고 배경만 새롭고 깔끔하게 바꾼다.",
        "인물의 위치, 표정, 관계감은 유지한다. 배경은 밝은 스튜디오, 공원, 여행지 같은 가족 친화적 장소로 자연스럽게 교체하고 인물 경계와 그림자를 맞춘다.",
        "새 배경이 적용된 가족사진",
        "4:3",
        ["background_style"],
        {"background_style": "밝은 스튜디오"},
    ),
    (
        "ai-photo-retouch",
        "없는 사람 추가하기",
        "첫 번째 사진은 단체사진, 두 번째 사진은 추가할 사람 참조로 사용해 빠진 사람을 자연스럽게 합성한다.",
        "추가 인물은 단체사진의 조명, 카메라 각도, 키 비율, 거리감에 맞게 배치한다. 기존 인물의 얼굴과 자세는 훼손하지 않고, 새 인물도 참조 사진의 정체성을 유지한다.",
        "빠진 사람이 자연스럽게 들어간 단체사진",
        "4:3",
        ["placement"],
        {"placement": "자연스럽게 빈 공간에"},
    ),
    (
        "ai-photo-retouch",
        "프로필 사진 보정",
        "인물 사진을 깔끔한 프로필 사진처럼 정리한다.",
        "얼굴 정체성은 유지하고 배경은 너무 튀지 않게 정돈한다. 조명, 피부톤, 눈빛, 머리카락 가장자리를 자연스럽게 보정해 학교·가족·프로필용으로 쓰기 좋은 사진으로 만든다.",
        "깔끔한 프로필 사진",
        "4:3",
        ["profile_style"],
        {"profile_style": "깔끔하게"},
    ),
    (
        "ai-photo-retouch",
        "어두운 사진 밝게",
        "역광이거나 어두운 사진을 밝고 선명하게 보정한다.",
        "인물 얼굴이 잘 보이도록 노출과 그림자를 자연스럽게 올린다. 배경 분위기는 유지하고 하이라이트가 하얗게 날아가지 않게 정리한다.",
        "밝아진 자연광 사진",
        "4:3",
        ["light_fix"],
        {"light_fix": "자연스럽게 밝게"},
    ),
    (
        "ai-photo-retouch",
        "흔들린 사진 선명하게",
        "조금 흔들리거나 초점이 약한 사진을 더 선명하게 보정한다.",
        "얼굴, 눈매, 머리카락, 옷 디테일을 자연스럽게 살린다. 원본에 없는 얼굴 특징을 새로 만들지 않고 과한 샤픈 노이즈를 피한다.",
        "더 선명한 인물 사진",
        "4:3",
        ["sharpness_fix"],
        {"sharpness_fix": "자연스럽게"},
    ),
    (
        "ai-photo-retouch",
        "오래된 사진 복원",
        "낡거나 색이 바랜 사진을 깨끗하게 복원한다.",
        "얼굴 특징과 원본 분위기는 유지하면서 스크래치, 얼룩, 색바램, 노이즈를 줄인다. 너무 현대적인 얼굴로 바꾸지 않는다.",
        "복원된 추억 사진",
        "4:3",
        ["restore_level"],
        {"restore_level": "원본 느낌 유지"},
    ),
    (
        "ai-photo-retouch",
        "색감 예쁘게 보정",
        "사진의 색감을 더 생기 있고 보기 좋게 보정한다.",
        "피부톤은 자연스럽게 유지하고 전체 색감, 대비, 채도를 균형 있게 정리한다. 과한 필터 느낌보다 깔끔한 보정 사진처럼 만든다.",
        "색감이 살아난 사진",
        "4:3",
        ["color_style"],
        {"color_style": "화사하게"},
    ),
    (
        "ai-photo-retouch",
        "배경 정리",
        "인물은 그대로 두고 배경의 지저분한 물건이나 산만한 요소를 자연스럽게 정리한다.",
        "배경을 완전히 바꾸기보다 원래 장소의 느낌을 유지하며 깔끔하게 만든다. 인물 경계와 그림자는 자연스럽게 맞춘다.",
        "깔끔한 배경의 인물 사진",
        "4:3",
        ["cleanup_level"],
        {"cleanup_level": "자연스럽게"},
    ),
    (
        "ai-photo-retouch",
        "표정 밝게 보정",
        "인물의 정체성은 유지하면서 표정을 조금 더 밝고 부드럽게 보정한다.",
        "입모양과 눈매를 과하게 바꾸지 않고, 어색하지 않은 미소와 편안한 인상으로 다듬는다. 단체사진에서는 모든 사람을 자연스럽게 유지한다.",
        "표정이 밝아진 사진",
        "4:3",
        ["smile_level"],
        {"smile_level": "살짝 밝게"},
    ),
    (
        "ai-photo-retouch",
        "의상 주름 정리",
        "인물의 옷차림은 유지하면서 의상의 심한 구김, 먼지, 작은 얼룩을 자연스럽게 정리한다.",
        "옷의 색과 형태는 유지한다. 새 옷으로 바꾸지 않고 촬영 전 정돈된 것처럼 깔끔하게 만든다.",
        "깔끔해진 의상 사진",
        "4:3",
        ["clothes_fix"],
        {"clothes_fix": "주름만 정리"},
    ),
    (
        "ai-photo-retouch",
        "단체사진 얼굴 보정",
        "단체사진에서 모든 사람의 얼굴 밝기와 피부톤을 균일하게 보정한다.",
        "각 사람의 얼굴 특징과 표정은 유지한다. 특정 사람만 과하게 바꾸지 않고 전체 조명, 눈감김 느낌, 얼굴 그림자를 균형 있게 정리한다.",
        "얼굴이 고르게 보정된 단체사진",
        "4:3",
        ["group_face_fix"],
        {"group_face_fix": "전체 균일하게"},
    ),
    (
        "ai-photo-retouch",
        "여행사진 하늘 보정",
        "여행사진의 하늘과 배경 색감을 더 맑고 예쁘게 보정한다.",
        "인물은 그대로 유지하고 하늘, 구름, 바다, 산 같은 배경만 자연스럽게 더 선명하고 깨끗하게 만든다. 비현실적인 합성 느낌은 피한다.",
        "맑은 여행사진",
        "16:9",
        ["sky_style"],
        {"sky_style": "맑고 화사하게"},
    ),
    (
        "ai-photo-retouch",
        "사진관 조명 보정",
        "일상 사진을 사진관에서 찍은 것처럼 조명과 톤을 정리한다.",
        "배경과 인물은 크게 바꾸지 않고 얼굴에 부드러운 주광, 은은한 그림자, 깔끔한 대비를 적용한다. 가족사진이나 프로필에 어울리게 만든다.",
        "사진관 느낌 보정 사진",
        "4:3",
        ["studio_light"],
        {"studio_light": "부드러운 조명"},
    ),
]


KID_TEMPLATE_CARDS = [
    # 상상 모험
    ("story-adventure-play", "구름 비행선 여행", "주인공이 파스텔 색 작은 비행선을 타고 폭신한 구름 위를 여행한다.", "한국 동화책과 고급 포토 일러스트가 섞인 부드러운 하늘 모험 분위기", "구름 집, 별 풍선, 리본 깃발, 따뜻한 햇살을 넣는다.", "세로형 동화 포스터", "3:4"),
    ("story-adventure-play", "장난감 기차 숲속 모험", "주인공이 알록달록한 장난감 기차를 타고 미니어처 숲을 지나간다.", "종이 공예 질감이 있는 따뜻한 숲속 이야기 스타일", "버섯 정류장, 도토리 벤치, 작은 등불을 넣는다.", "세로형 스토리 카드", "3:4"),
    ("story-adventure-play", "반짝 도서관 탐험", "주인공이 책이 둥둥 떠다니는 포근한 마법 도서관을 탐험한다.", "무섭지 않은 판타지 도서관, 남색과 금빛 조명, 차분한 신비감", "그림책, 별자리, 사다리, 종이 별 장식을 넣는다.", "세로형 책 표지", "3:4"),
    ("story-adventure-play", "비눗방울 우주 여행", "주인공이 투명한 무지개 비눗방울 안에서 귀여운 우주를 여행한다.", "파스텔 우주, 반짝이는 버블, 안전하고 귀여운 SF 감성", "장난감 로켓, 솜사탕 성운, 별 스티커를 넣는다.", "정사각 카드", "1:1"),
    ("story-adventure-play", "쿠키 마을 산책", "주인공이 쿠키 집과 젤리 창문이 있는 작은 과자 마을을 산책한다.", "깨끗하고 먹음직한 동화풍 베이커리 판타지", "사탕 꽃, 크림 길, 작은 깃발을 넣는다.", "세로형 동화 일러스트", "3:4"),
    ("story-adventure-play", "종이배 바다 탐험", "주인공이 커다란 종이배를 타고 반짝이는 실내 바다를 건넌다.", "한국 여름 동화 감성, 종이 공예 세트, 밝은 파랑 톤", "조개 장난감, 종이 갈매기, 작은 물고기를 넣는다.", "세로형 포스터", "3:4"),
    ("story-adventure-play", "작은 요정 정원", "주인공이 반짝이는 꽃과 작은 찻상이 있는 미니 정원에 초대된다.", "부드러운 판타지 정원, 따뜻한 보케 조명, 자연스러운 피부 질감", "이슬방울, 꽃 등불, 작은 의자를 넣는다.", "세로형 인물 카드", "3:4"),
    ("story-adventure-play", "하늘 피크닉 열기구", "주인공이 둥근 열기구 바구니에서 하늘 피크닉을 즐긴다.", "밝은 어린이 잡지 표지 같은 색감, 주황과 하늘색 포인트", "피크닉 바구니, 종이 가랜드, 구름 배경을 넣는다.", "세로형 표지", "3:4"),
    ("story-adventure-play", "거대 꽃잎 놀이터", "주인공이 큰 꽃잎 미끄럼틀이 있는 정원 놀이터에서 논다.", "포토리얼 판타지 놀이터, 매크로 꽃 세계, 부드러운 햇빛", "잎 우산, 꽃가루 반짝임, 안전한 놀이 자세를 넣는다.", "세로형 놀이 포스터", "3:4"),
    ("story-adventure-play", "무지개 문 앞에서", "주인공이 반짝이는 무지개 문 앞에서 새로운 놀이터를 발견한다.", "프리미엄 동화 초상, 파스텔 무지개 조명, 깨끗한 배경", "열쇠 장식, 작은 랜턴, 리본을 넣는다.", "세로형 판타지 포스터", "3:4"),
    # 계절·축제
    ("season-festival-play", "여름 수박 수영장", "주인공이 수박 모양 작은 풀장 옆에서 여름 놀이를 즐긴다.", "밝은 한국 여름 광고 포스터 감성, 물방울과 장난감 질감", "수영 고글, 튜브, 과일 장난감, 햇살을 넣는다.", "세로형 여름 포스터", "3:4"),
    ("season-festival-play", "봄 벚꽃 피크닉", "주인공이 벚꽃 아래에서 포근한 봄 피크닉을 한다.", "파스텔 봄 포토카드, 분홍 꽃잎, 밝고 부드러운 자연광", "피크닉 매트, 작은 꽃 장식, 흩날리는 꽃잎을 넣는다.", "가로형 포토카드", "4:3"),
    ("season-festival-play", "가을 낙엽 탐정", "주인공이 장난감 돋보기를 들고 예쁜 단풍잎을 찾는 탐정이 된다.", "따뜻한 가을 동화 포스터, 호박색과 크림색 중심", "낙엽 지도, 도토리, 작은 노트를 넣는다.", "세로형 이야기 카드", "3:4"),
    ("season-festival-play", "겨울 쿠키 가게", "주인공이 눈송이 장식이 있는 따뜻한 겨울 쿠키 가게에 서 있다.", "귀여운 겨울 베이커리 포스터, 크림색과 파란색 조명", "쿠키 트레이, 장갑, 창문 눈송이 스티커를 넣는다.", "세로형 겨울 포스터", "3:4"),
    ("season-festival-play", "생일 케이크 무대", "주인공이 거대한 파스텔 케이크 배경의 작은 생일 무대에 선다.", "세련된 생일 포스터, 밝은 조명, 둥근 장식 요소", "풍선, 선물, 별 가랜드, 안전한 색종이를 넣는다.", "세로형 축하 카드", "3:4"),
    ("season-festival-play", "어린이날 놀이공원 티켓", "주인공이 즐거운 어린이날 놀이공원 티켓 포스터의 주인공이 된다.", "컬러풀한 티켓형 포스터, 귀여운 놀이기구 배경", "솜사탕 색감, 회전목마 느낌의 원본 장식, 티켓 프레임을 넣는다.", "가로형 티켓 카드", "16:9"),
    ("season-festival-play", "비 오는 날 우산 산책", "주인공이 귀여운 우비와 우산을 들고 밝은 빗길을 걷는다.", "무섭지 않은 비 오는 날 영화 같은 사진 일러스트", "파스텔 우산, 반사되는 물웅덩이, 따뜻한 창문빛을 넣는다.", "세로형 감성 사진", "2:3"),
    ("season-festival-play", "아이스크림 트럭 여름", "주인공이 알록달록한 아이스크림 트럭 옆에서 여름 모델이 된다.", "프리미엄 여름 상업 포스터, 광택 있는 파스텔 표면", "아이스바 장식, 메뉴판 모양 배경, 산뜻한 바람을 넣는다.", "세로형 광고 포스터", "3:4"),
    ("season-festival-play", "추석 달빛 마당", "주인공이 둥근 달빛 아래 따뜻한 한국 명절 마당에서 웃고 있다.", "현대적인 한국 동화 감성, 은은한 달빛과 종이등", "송편 바구니, 달 장식, 토끼 모양 등불을 넣는다.", "세로형 명절 카드", "3:4"),
    ("season-festival-play", "크리스마스 장난감 공방", "주인공이 따뜻한 불빛의 장난감 공방에서 선물을 준비한다.", "포근한 겨울 홀리데이 스토리북, 빨강·초록·금색 포인트", "나무 블록, 리본, 별 장식을 넣되 산타나 유명 캐릭터는 넣지 않는다.", "세로형 겨울 카드", "3:4"),
    # 포스터·카드
    ("poster-card-studio", "몽글바다 목욕놀이 광고", "주인공이 거대한 귀여운 바다 캐릭터 버블 배스 병 안에 앉아 있다.", "포토리얼 기반 어린이 목욕 제품 광고, 한국 여름 욕실, 반짝이는 플라스틱과 풍성한 거품", "병 라벨에 둥근 한글 '몽글바다', 해달 장난감, 돌고래, 조개, 레인보우 폼을 넣는다.", "세로형 광고 포스터", "3:4"),
    ("poster-card-studio", "과일 주스 광고 모델", "주인공이 커다란 과일 소품 옆에서 신선한 주스 포스터 모델이 된다.", "깨끗한 스튜디오 광고, 광택 과일, 밝은 배경", "오렌지, 딸기, 투명 컵, 과즙 스플래시를 넣는다.", "세로형 광고 포스터", "3:4"),
    ("poster-card-studio", "상상 잡지 표지", "주인공이 상상과 놀이를 주제로 한 어린이 잡지 표지 모델이 된다.", "현대적인 에디토리얼 커버, 부드러운 스튜디오 초상", "제목 영역, 추상 도형, 파스텔 배경을 넣는다.", "세로형 잡지 표지", "3:4"),
    ("poster-card-studio", "모험 영화 포스터", "주인공이 밝은 마을을 배경으로 가족 모험 영화 포스터의 주인공이 된다.", "가볍고 신나는 영화 포스터, 따뜻한 히어로 조명", "장난감 소품, 빛나는 길, 구름, 역동적인 안전 포즈를 넣는다.", "세로형 영화 포스터", "3:4"),
    ("poster-card-studio", "응원 포토카드", "주인공이 깃발과 색종이 속에서 활기찬 응원 포토카드 모델이 된다.", "스포츠 카드 디자인, 실제 팀 로고 없는 에너지 있는 그래픽", "번호 모양, 카드 프레임, 리본, 색종이를 넣는다.", "세로형 포토카드", "2:3"),
    ("poster-card-studio", "꿈 발표회 포스터", "주인공이 작은 학교 발표회 무대에서 자신감 있게 서 있다.", "따뜻한 학교 행사 포스터, 친근한 스포트라이트", "커튼, 별, 손그림 간판, 종이 장식을 넣는다.", "세로형 발표회 포스터", "3:4"),
    ("poster-card-studio", "도서관 독서왕 포스터", "주인공이 포근한 도서관 코너에서 독서 캠페인 포스터 모델이 된다.", "교육 캠페인 포스터, 따뜻한 램프 조명과 책 배경", "책갈피, 열린 책, 작은 반짝임, 배너 공간을 넣는다.", "세로형 캠페인 포스터", "3:4"),
    ("poster-card-studio", "지구 지킴이 포스터", "주인공이 작은 식물에 물을 주는 친환경 포스터의 주인공이 된다.", "귀여운 에코 캠페인, 초록과 하늘색 팔레트", "새싹, 물뿌리개, 재활용 느낌의 추상 아이콘을 넣는다.", "세로형 캠페인 포스터", "3:4"),
    ("poster-card-studio", "우주 과학 포스터", "주인공이 장난감 망원경과 파스텔 행성 옆에 서 있다.", "교육 과학 포스터, 파랑과 보라 우주 톤, 무섭지 않은 경이감", "궤도선, 별 스티커, 로켓 장난감, 교실 실험실 느낌을 넣는다.", "세로형 과학 포스터", "3:4"),
    ("poster-card-studio", "카페 디저트 메뉴 포스터", "주인공이 밝은 가족 카페의 디저트 진열대 옆에 선다.", "프리미엄 카페 광고, 민트·코랄·크림 색감", "컵케이크, 과일 타르트, 가격 없는 메뉴판 모양을 넣는다.", "세로형 메뉴 포스터", "3:4"),
    # 스티커·이모티콘
    ("sticker-emoji-maker", "동글 얼굴 스티커", "주인공을 얼굴 특징이 살아 있는 동글동글한 스티커 캐릭터로 만든다.", "깨끗한 스티커 디자인, 흰색 배경 느낌, 두꺼운 부드러운 외곽선", "반짝이와 밝은 미소를 넣고 텍스트는 넣지 않는다.", "정사각 스티커", "1:1"),
    ("sticker-emoji-maker", "응원 이모티콘", "주인공이 작은 응원 도구를 들고 힘내라고 응원하는 이모티콘이 된다.", "한국 메신저 이모티콘 스타일, 단순하고 읽기 쉬운 실루엣", "별, 움직임 선, 빈 말풍선 공간을 넣되 글자는 만들지 않는다.", "정사각 이모티콘", "1:1"),
    ("sticker-emoji-maker", "하트 뿅 스티커", "주인공이 작은 하트들 사이에서 따뜻하게 웃는 스티커가 된다.", "광택 있는 귀여운 스티커, 분홍과 코랄 포인트", "둥근 외곽선, 작은 하트, 반짝임을 넣는다.", "정사각 스티커", "1:1"),
    ("sticker-emoji-maker", "깜짝 표정 이모티콘", "주인공이 놀란 표정으로 귀여운 리액션 이모티콘이 된다.", "밝은 노랑과 파랑 포인트, 과하지 않은 만화 리액션", "느낌표 모양 장식은 넣되 읽히는 텍스트는 넣지 않는다.", "정사각 이모티콘", "1:1"),
    ("sticker-emoji-maker", "생일 축하 스티커", "주인공이 작은 파티 모자를 쓰고 생일 축하 스티커가 된다.", "컬러풀한 스티커 일러스트, 색종이와 풍선", "케이크 아이콘, 선물, 둥근 테두리를 넣는다.", "정사각 스티커", "1:1"),
    ("sticker-emoji-maker", "반짝 프로필 아이콘", "주인공 얼굴 중심의 세련된 원형 프로필 아이콘을 만든다.", "프리미엄 귀여운 아바타, 파스텔 그라데이션 배경", "헤어스타일과 인상은 유지하고 작은 반짝임을 넣는다.", "정사각 프로필 아이콘", "1:1"),
    ("sticker-emoji-maker", "동물 후드 캐릭터", "주인공이 오리지널 곰 또는 토끼 후드를 쓴 귀여운 스티커가 된다.", "부드러운 인형 후드, 둥근 스티커 아트, 따뜻한 눈빛", "유명 캐릭터를 따라 하지 않고 귀와 발바닥 장식을 새롭게 디자인한다.", "정사각 스티커", "1:1"),
    ("sticker-emoji-maker", "브이 포즈 포토스티커", "주인공이 밝은 스튜디오에서 브이 포즈를 하는 포토부스 스티커가 된다.", "한국 포토스티커 스타일, 광택 테두리, 작은 장식 아이콘", "별, 하트, 테이프 프레임을 넣는다.", "정사각 포토스티커", "1:1"),
    ("sticker-emoji-maker", "졸린 구름 이모티콘", "주인공이 폭신한 구름 베개에 기대어 졸린 표정을 짓는다.", "파스텔 라벤더와 크림 톤, 편안한 스티커 아트", "작은 달과 별 장식을 넣고 무서운 밤 분위기는 피한다.", "정사각 이모티콘", "1:1"),
    ("sticker-emoji-maker", "최고야 엄지척 스티커", "주인공이 자신감 있게 엄지척을 하는 긍정 스티커가 된다.", "밝은 파랑과 노랑 포인트, 굵은 흰색 외곽선", "활기찬 표정, 작은 별 장식, 깨끗한 배경을 넣는다.", "정사각 스티커", "1:1"),
    # 직업·체험
    ("learning-world-tour", "꼬마 과학자 실험실", "주인공이 안전한 색 물감 실험을 하는 어린이 과학자가 된다.", "교육 포스터, 파스텔 실험실, 사실적인 얼굴과 놀이형 일러스트", "비커, 돋보기, 별자리 차트, 위험하지 않은 소품을 넣는다.", "세로형 과학 카드", "3:4"),
    ("learning-world-tour", "우주비행사 훈련실", "주인공이 오리지널 우주 훈련복을 입고 밝은 우주 교실에 서 있다.", "과학관 포스터, 흰색과 파란색, 귀여운 미래 공간", "장난감 로켓, 추상 조작판, 파스텔 행성을 넣는다.", "세로형 체험 포스터", "3:4"),
    ("learning-world-tour", "정원 꽃 연구원", "주인공이 온실에서 꽃을 돌보는 친절한 정원 연구원이 된다.", "자연 교육 포스터, 초록 햇살, 따뜻한 온실 분위기", "물뿌리개, 씨앗 봉투, 나비 소품을 넣는다.", "세로형 자연 카드", "3:4"),
    ("learning-world-tour", "미니 셰프 쿠킹 클래스", "주인공이 밝은 주방에서 과일 팬케이크를 꾸미는 셰프가 된다.", "가족 요리 포스터, 따뜻한 주방 조명, 안전한 조리 소품", "앞치마, 믹싱볼, 베리류를 넣고 칼 같은 위험 도구는 넣지 않는다.", "세로형 요리 카드", "3:4"),
    ("learning-world-tour", "작은 건축가 도시 만들기", "주인공이 블록과 종이집으로 미니 도시를 만드는 건축가가 된다.", "창의 학습 포스터, 부드러운 스튜디오 조명, 알록달록한 모형 도시", "자, 블록, 종이 나무, 로고 없는 작은 건물을 넣는다.", "가로형 만들기 카드", "4:3"),
    ("learning-world-tour", "바다 생물 연구원", "주인공이 수족관 교실에서 귀여운 바다 생물 장난감을 관찰한다.", "교육용 오션 포스터, 파란 물빛, 친근한 원본 바다 생물", "노트, 조개 표본, 장난감 잠수함을 넣는다.", "세로형 연구 카드", "3:4"),
    ("learning-world-tour", "날씨 캐스터 체험", "주인공이 귀여운 날씨 보드 앞에서 밝게 발표하는 캐스터가 된다.", "어린이 방송 포스터, 깨끗한 스튜디오, 해와 구름 아이콘", "우산, 구름, 바람, 햇살 그래픽을 넣되 방송사 로고는 넣지 않는다.", "가로형 방송 카드", "16:9"),
    ("learning-world-tour", "박물관 시간 여행", "주인공이 따뜻한 박물관 전시실에서 지도와 유물을 살펴본다.", "교육 박물관 모험, 황금빛 조명, 무섭지 않은 역사 탐험", "전시 케이스, 지도 두루마리, 작은 랜턴 느낌을 넣는다.", "세로형 탐험 카드", "3:4"),
    ("learning-world-tour", "음악 지휘자 무대", "주인공이 작은 교실 콘서트 무대에서 귀여운 지휘자가 된다.", "따뜻한 콘서트 포스터, 장난감 악기, 부드러운 스포트라이트", "음표 장식, 실로폰, 작은 북 소품을 넣는다.", "세로형 음악 카드", "3:4"),
    ("learning-world-tour", "로봇 친구 만들기", "주인공이 메이커 교실에서 알록달록한 블록 로봇 친구를 만든다.", "STEM 학습 포스터, 밝은 작업대, 친근한 장난감 로봇", "안전한 장식용 선, 스티커, 블록, 자랑스러운 표정을 넣는다.", "세로형 메이커 카드", "3:4"),
    # 잡지 스타일
    ("magazine-style", "키즈 패션 매거진", "주인공이 밝은 스튜디오에서 귀엽고 세련된 패션 화보 모델이 된다.", "프리미엄 어린이 패션 매거진, 깨끗한 배경, 부드러운 스튜디오 조명", "파스텔 소품, 종이 오브제, 세련된 표지 여백을 넣되 읽히는 글자는 넣지 않는다.", "세로형 잡지 표지", "3:4"),
    ("magazine-style", "여행 라이프 매거진", "주인공이 여행 잡지 표지처럼 산뜻한 도시 산책 장면에 서 있다.", "밝은 라이프스타일 매거진 화보, 자연광, 세련된 거리 배경", "캐리어, 지도, 카페 테라스 느낌을 넣되 로고는 넣지 않는다.", "세로형 여행 잡지 표지", "3:4"),
    ("magazine-style", "과학 탐구 매거진", "주인공이 신기한 과학 소품을 살펴보는 탐구 잡지의 모델이 된다.", "교육 매거진 커버, 깨끗한 실험실, 푸른빛과 흰색 중심", "돋보기, 별자리 그래픽, 안전한 과학 장난감을 넣는다.", "세로형 과학 잡지 표지", "3:4"),
    ("magazine-style", "스포츠 응원 매거진", "주인공이 활기찬 스포츠 응원 화보의 주인공이 된다.", "에너지 있는 스포츠 매거진, 강한 컬러 블록, 깨끗한 스튜디오 조명", "깃발, 색종이, 숫자 그래픽을 넣되 실제 팀 로고는 넣지 않는다.", "세로형 스포츠 잡지", "3:4"),
    ("magazine-style", "아트 전시 매거진", "주인공이 알록달록한 미술 전시 공간에서 감각적인 화보 모델이 된다.", "모던 아트 매거진, 흰 전시장, 선명한 색면과 부드러운 조명", "캔버스, 조형물, 붓 터치 그래픽을 넣는다.", "세로형 아트 잡지", "3:4"),
    ("magazine-style", "요리 클래스 매거진", "주인공이 밝은 주방에서 디저트를 꾸미는 요리 잡지 표지 모델이 된다.", "따뜻한 푸드 매거진, 깨끗한 주방, 크림과 민트 색감", "과일, 작은 케이크, 안전한 조리 도구만 넣는다.", "세로형 푸드 잡지", "3:4"),
    ("magazine-style", "음악 공연 매거진", "주인공이 작은 무대 조명 아래 음악 공연 잡지 화보처럼 선다.", "프리미엄 공연 매거진, 따뜻한 스포트라이트, 세련된 무대 배경", "마이크 스탠드, 음표 그래픽, 작은 악기 소품을 넣는다.", "세로형 공연 잡지", "3:4"),
    ("magazine-style", "자연 탐험 매거진", "주인공이 초록 식물원에서 자연 탐험 잡지 모델이 된다.", "내셔널 탐험 잡지 느낌이지만 특정 브랜드 없이 밝고 어린이 친화적", "쌍안경, 식물 노트, 햇살이 비치는 잎사귀를 넣는다.", "세로형 자연 잡지", "3:4"),
    ("magazine-style", "미래 도시 매거진", "주인공이 파스텔 미래 도시 배경의 트렌드 매거진 모델이 된다.", "깨끗한 미래 도시 에디토리얼, 유리 건물, 하늘색과 은색 조명", "홀로그램 느낌의 추상 도형, 안전한 보행로, 부드러운 미소를 넣는다.", "세로형 미래 잡지", "3:4"),
    ("magazine-style", "북카페 감성 매거진", "주인공이 포근한 북카페 창가에서 독서 라이프 매거진 모델이 된다.", "따뜻한 라이프스타일 화보, 나무 질감, 오후 햇살", "책, 머그컵, 작은 식물, 부드러운 배경 흐림을 넣는다.", "세로형 라이프 매거진", "3:4"),
    # 세계 주요 관광지
    ("world-landmark-tour", "파리 에펠탑 피크닉", "주인공이 파리 에펠탑이 보이는 공원에서 밝은 피크닉을 즐긴다.", "프리미엄 여행 화보, 파스텔 하늘, 따뜻한 유럽 공원 분위기", "피크닉 바구니, 꽃, 부드러운 햇살을 넣고 로고나 상표는 넣지 않는다.", "세로형 여행 포스터", "3:4"),
    ("world-landmark-tour", "런던 빅벤 산책", "주인공이 런던 빅벤 근처의 깨끗한 거리에서 여행 사진처럼 걷는다.", "고급 여행 잡지 스타일, 흐린 듯 부드러운 영국 하늘, 클래식한 거리", "우산, 빨간 포인트 소품, 돌길 반사를 넣는다.", "세로형 여행 사진", "3:4"),
    ("world-landmark-tour", "뉴욕 야경 광장", "주인공이 뉴욕의 밝은 도시 광장 분위기 속에서 여행 화보처럼 서 있다.", "시네마틱 도시 여행, 네온 조명 느낌, 안전하고 밝은 밤거리", "택시 색감, 높은 건물, 빛 번짐을 넣되 실제 광고판 글자는 넣지 않는다.", "세로형 도시 포스터", "3:4"),
    ("world-landmark-tour", "로마 콜로세움 탐험", "주인공이 로마 콜로세움이 보이는 광장에서 역사 여행을 즐긴다.", "따뜻한 지중해 여행 화보, 황금빛 석양, 고대 건축 배경", "지도, 작은 카메라, 돌길 질감을 넣는다.", "세로형 역사 여행 카드", "3:4"),
    ("world-landmark-tour", "이집트 피라미드 여행", "주인공이 이집트 피라미드가 보이는 밝은 사막 여행 장면에 있다.", "가족 친화적인 모험 여행 포스터, 따뜻한 모래빛, 푸른 하늘", "스카프, 여행 가방, 그림자 긴 사막 길을 넣되 위험한 분위기는 피한다.", "세로형 모험 여행 카드", "3:4"),
    ("world-landmark-tour", "시드니 오페라하우스", "주인공이 시드니 오페라하우스와 푸른 항구를 배경으로 웃고 있다.", "상쾌한 항구 여행 화보, 깨끗한 바다빛, 밝은 낮 조명", "돛 모양 배경, 산책로, 바람에 날리는 리본을 넣는다.", "가로형 항구 여행 사진", "4:3"),
    ("world-landmark-tour", "도쿄 벚꽃 거리", "주인공이 도쿄의 벚꽃 거리와 도시 풍경 속에서 산책한다.", "파스텔 일본 여행 화보, 벚꽃, 깨끗한 거리, 부드러운 자연광", "작은 가방, 꽃잎, 횡단보도 느낌의 추상 그래픽을 넣는다.", "세로형 봄 여행 카드", "3:4"),
    ("world-landmark-tour", "싱가포르 슈퍼트리 가든", "주인공이 싱가포르의 거대한 슈퍼트리 정원 느낌 배경 앞에 선다.", "미래적인 식물원 여행 포스터, 보라와 초록 조명, 가족 친화적", "정원 산책로, 큰 나무 구조물, 반짝이는 야간 조명을 넣는다.", "세로형 야간 여행 포스터", "3:4"),
    ("world-landmark-tour", "두바이 미래 도시", "주인공이 두바이의 현대적인 고층 도시와 깨끗한 분수 앞에 선다.", "럭셔리 여행 매거진, 금빛 햇살, 유리 건물과 푸른 하늘", "분수, 야자수, 넓은 광장을 넣되 실제 브랜드 표기는 넣지 않는다.", "세로형 도시 여행 카드", "3:4"),
    ("world-landmark-tour", "스위스 알프스 기차", "주인공이 스위스 알프스 산악 기차 여행 장면에서 창밖 풍경을 본다.", "맑은 산악 여행 화보, 푸른 호수, 눈 덮인 산, 따뜻한 기차 내부", "창가 좌석, 작은 가방, 햇살과 산 풍경을 넣는다.", "가로형 기차 여행 카드", "16:9"),
    # 필름 스타일
    ("film-style", "따뜻한 컬러 필름", "주인공이 햇살 가득한 거리에서 따뜻한 컬러 필름 사진처럼 찍힌다.", "빈티지 컬러 필름, 부드러운 입자감, 노란 햇살, 자연스러운 피부톤", "빛샘, 필름 그레인, 오래된 거리의 따뜻한 분위기를 넣는다.", "세로형 필름 포트레이트", "3:4"),
    ("film-style", "여름 바다 필름", "주인공이 여름 바닷가에서 청량한 필름 사진 분위기로 서 있다.", "시원한 여름 필름, 파란 하늘, 은은한 색바램, 부드러운 콘트라스트", "파도, 모래, 작은 비치 소품, 햇살 반짝임을 넣는다.", "가로형 여름 필름", "4:3"),
    ("film-style", "빈티지 도시 산책", "주인공이 오래된 골목과 카페 거리에서 빈티지 필름 컷처럼 걷는다.", "도시 스냅 필름, 낮은 채도, 자연광, 거리 사진 감성", "간판은 읽히지 않게 흐리고, 벽돌, 창문 반사, 작은 그림자를 넣는다.", "세로형 도시 스냅", "2:3"),
    ("film-style", "밤거리 시네마 필름", "주인공이 비 온 뒤 반짝이는 밤거리에서 영화 필름처럼 서 있다.", "시네마틱 필름, 네온 반사, 짙은 파랑과 따뜻한 주황 조명", "물웅덩이 반사, 부드러운 빛 번짐, 안전한 거리 분위기를 넣는다.", "세로형 시네마 컷", "3:4"),
    ("film-style", "폴라로이드 추억", "주인공이 밝은 방 안에서 폴라로이드 사진 같은 추억 컷으로 나온다.", "부드러운 즉석사진 느낌, 크림색 하이라이트, 낮은 선명도, 따뜻한 실내광", "사진 앨범, 작은 조명, 흰 테두리 느낌을 넣되 실제 프레임 텍스트는 넣지 않는다.", "정사각 감성 사진", "1:1"),
    ("film-style", "90년대 가족앨범", "주인공이 오래된 가족앨범 속 사진처럼 포근한 실내에서 웃고 있다.", "90년대 필름 앨범, 플래시 느낌, 약간의 색바램과 부드러운 입자", "패턴 커튼, 작은 소품, 따뜻한 방 분위기를 넣는다.", "가로형 앨범 사진", "4:3"),
    ("film-style", "기차역 감성 필름", "주인공이 햇살 드는 기차역 플랫폼에서 여행 필름 사진처럼 서 있다.", "감성 여행 필름, 역광, 부드러운 입자, 따뜻한 베이지 톤", "기차 창문, 여행 가방, 긴 그림자를 넣는다.", "세로형 여행 필름", "3:4"),
    ("film-style", "햇살 창가 필름", "주인공이 창가 햇살 속에서 조용한 필름 포트레이트처럼 앉아 있다.", "부드러운 인물 필름, 따뜻한 창문빛, 크림색과 연한 초록 톤", "커튼, 책, 작은 식물, 얕은 심도를 넣는다.", "세로형 필름 인물", "3:4"),
    ("film-style", "비 오는 날 필름", "주인공이 투명 우산 아래에서 촉촉한 비 오는 날 필름 사진처럼 걷는다.", "감성 필름 스냅, 회색 하늘, 젖은 길 반사, 차분하지만 밝은 분위기", "우산, 빗방울, 창문 조명을 넣고 어둡거나 무섭지 않게 만든다.", "세로형 비 오는 날 필름", "3:4"),
    ("film-style", "골든아워 포트레이트", "주인공이 해 질 녘 황금빛 들판이나 공원에서 따뜻한 인물 사진처럼 보인다.", "골든아워 필름, 부드러운 플레어, 따뜻한 오렌지와 초록 색감", "바람에 흔들리는 머리카락, 풀밭, 역광 윤곽선을 넣는다.", "세로형 골든아워 인물", "3:4"),
]

LEGACY_TEMPLATE_PREVIEW_ALIASES = {
    "가을 낙엽 탐정 놀이": "가을 낙엽 탐정",
    "거대한 꽃잎 미끄럼틀": "거대 꽃잎 놀이터",
    "겨울 눈꽃 쿠키 가게": "겨울 쿠키 가게",
    "과자 집 마을 산책": "쿠키 마을 산책",
    "구름 위 작은 비행선 여행": "구름 비행선 여행",
    "기상 캐스터 체험": "날씨 캐스터 체험",
    "꿈 발표회 무대 포스터": "꿈 발표회 포스터",
    "나만의 잡지 표지": "상상 잡지 표지",
    "놀람 표정 이모티콘": "깜짝 표정 이모티콘",
    "달빛 도서관 탐험": "반짝 도서관 탐험",
    "동글 얼굴 스티커 세트": "동글 얼굴 스티커",
    "무지개 비밀문 앞에서": "무지개 문 앞에서",
    "봄 벚꽃 소풍 카드": "봄 벚꽃 피크닉",
    "브이 포즈 포토 스티커": "브이 포즈 포토스티커",
    "비 오는 날 장화 산책": "비 오는 날 우산 산책",
    "비눗방울 우주 산책": "비눗방울 우주 여행",
    "숲속 작은 요정 정원": "작은 요정 정원",
    "스포츠 응원 포토카드": "응원 포토카드",
    "아이가 여름 바다 목욕놀이 포스터 만들기": "몽글바다 목욕놀이 광고",
    "여름 수박 수영장 포스터": "여름 수박 수영장",
    "영화 예고 포스터": "모험 영화 포스터",
    "우주비행사 훈련소": "우주비행사 훈련실",
    "인물 동화 변신": "작은 요정 정원",
    "잠자는 구름 이모티콘": "졸린 구름 이모티콘",
    "정원사 꽃 연구소": "정원 꽃 연구원",
    "추석 달토끼 마당": "추석 달빛 마당",
    "풍선 열기구 피크닉": "하늘 피크닉 열기구",
    "한여름 아이스크림 트럭": "아이스크림 트럭 여름",
    "환경 지킴이 포스터": "지구 지킴이 포스터",
}

CUSTOM_TEMPLATE_PREVIEW_URLS = {
    "동글 얼굴 스티커": "/template-previews/dongle-face-sticker-preview.png",
    "동글 얼굴 스티커 세트": "/template-previews/dongle-face-sticker-preview.png",
}


def _preview_urls_by_template_name() -> dict[str, str]:
    preview_urls = {
        name: _preview_url(f"{category_slug}:{name}")
        for category_slug, name, *_rest in KID_TEMPLATE_CARDS
    }
    preview_urls.update(CUSTOM_TEMPLATE_PREVIEW_URLS)
    return preview_urls


def _template_ids_by_template_name() -> dict[str, UUID]:
    return {
        name: _uuid(f"template:{category_slug}:{name}")
        for category_slug, name, *_rest in KID_TEMPLATE_CARDS
    }


async def _upsert_category(
    db: AsyncSession,
    slug: str,
    name: str,
    description: str,
    sort_order: int,
    *,
    kind: str = "template",
) -> Category:
    result = await db.execute(select(Category).where(Category.slug == slug))
    category = result.scalar_one_or_none()
    if category is None:
        category = Category(
            id=_uuid(f"category:{slug}"),
            name=name,
            slug=slug,
            kind=kind,
            description=description,
            sort_order=sort_order,
            is_active=True,
        )
        db.add(category)
        await db.flush()
        return category

    category.name = name
    category.kind = kind
    category.description = description
    category.sort_order = sort_order
    category.is_active = True
    return category


async def _upsert_template(
    db: AsyncSession,
    *,
    category: Category,
    index: int,
    name: str,
    scene: str,
    style: str,
    details: str,
    composition: str,
    aspect_ratio: str,
) -> None:
    seed_slug = f"{category.slug}:{name}"
    base_prompt = _prompt(scene, style, details, composition)
    preview_url = _preview_url(seed_slug)
    template_id = _uuid(f"template:{seed_slug}")
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.id == template_id))
    template = result.scalar_one_or_none()
    description = "인물 사진만 올리면 바로 만들 수 있는 GPT Image 2 카드예요."
    locale_labels = {"seed_slug": seed_slug, "card_subtitle": composition}

    if template is None:
        template = PromptTemplate(
            id=template_id,
            category_id=category.id,
            name=name,
            description=description,
            thumbnail_url=preview_url,
            base_prompt=base_prompt,
            variables=[],
            default_values={},
            negative_terms=SAFE_NEGATIVE_TERMS,
            recommended_age="전체",
            locale_labels=locale_labels,
            requires_source_photo=True,
            aspect_ratio=aspect_ratio,
            visible_user_fields=[],
            is_public=True,
            is_active=True,
            is_recommended=index <= 2,
            example_image_url=preview_url,
        )
        db.add(template)
        await db.flush()
    else:
        template.category_id = category.id
        template.description = description
        template.thumbnail_url = preview_url
        template.base_prompt = base_prompt
        template.variables = []
        template.default_values = {}
        template.negative_terms = SAFE_NEGATIVE_TERMS
        template.recommended_age = "전체"
        template.locale_labels = locale_labels
        template.requires_source_photo = True
        template.aspect_ratio = aspect_ratio
        template.visible_user_fields = []
        template.is_public = True
        template.is_active = True
        template.is_recommended = index <= 2
        template.example_image_url = preview_url

    version_result = await db.execute(
        select(PromptTemplateVersion).where(
            PromptTemplateVersion.template_id == template.id,
            PromptTemplateVersion.version_number == 1,
        )
    )
    version = version_result.scalar_one_or_none()
    if version is None:
        db.add(
            PromptTemplateVersion(
                id=_uuid(f"version:{seed_slug}:1"),
                template_id=template.id,
                version_number=1,
                base_prompt=base_prompt,
                variables=[],
                default_values={},
                negative_terms=SAFE_NEGATIVE_TERMS,
            )
        )
    else:
        version.base_prompt = base_prompt
        version.variables = []
        version.default_values = {}
        version.negative_terms = SAFE_NEGATIVE_TERMS


async def _upsert_retouch_template(
    db: AsyncSession,
    *,
    category: Category,
    index: int,
    name: str,
    goal: str,
    details: str,
    output: str,
    aspect_ratio: str,
    visible_user_fields: list[str],
    default_values: dict[str, object],
) -> None:
    seed_slug = f"{category.slug}:{name}"
    base_prompt = _retouch_prompt(goal, details, output)
    template_id = _uuid(f"retouch-template:{seed_slug}")
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.id == template_id))
    template = result.scalar_one_or_none()
    description = "사진을 올리면 자연스럽게 보정해서 새 사진으로 저장하는 AI사진보정 카드예요."
    variables = [
        {
            "key": key,
            "label": {
                "body_style": "키 보정 느낌",
                "skin_finish": "피부 보정 느낌",
                "blemish_level": "잡티 제거 느낌",
                "youth_level": "회춘 느낌",
                "background_style": "배경 스타일",
                "placement": "추가 위치",
                "profile_style": "프로필 느낌",
                "light_fix": "밝기 보정",
                "sharpness_fix": "선명도",
                "restore_level": "복원 느낌",
                "color_style": "색감",
                "cleanup_level": "정리 정도",
                "smile_level": "표정",
                "clothes_fix": "의상 정리",
                "group_face_fix": "단체 보정",
                "sky_style": "하늘 보정",
                "studio_light": "조명",
                "retouch_style": "보정 스타일",
            }.get(key, "옵션"),
            "input_type": "choice",
            "choices": {
                "body_style": ["자연스럽게", "조금 더 길게", "프로필 사진처럼"],
                "skin_finish": ["뽀샤시하게", "맑고 자연스럽게", "화사하게"],
                "blemish_level": ["자연스럽게", "깨끗하게", "피부결 유지"],
                "youth_level": ["자연스럽게", "생기 있게", "젊은 프로필 느낌"],
                "background_style": ["밝은 스튜디오", "따뜻한 공원", "여행지 느낌"],
                "placement": ["자연스럽게 빈 공간에", "가운데 가까이", "옆자리처럼"],
                "profile_style": ["깔끔하게", "부드럽게", "증명사진 느낌"],
                "light_fix": ["자연스럽게 밝게", "역광 보정", "실내 조명처럼"],
                "sharpness_fix": ["자연스럽게", "얼굴 중심", "전체 선명하게"],
                "restore_level": ["원본 느낌 유지", "깨끗하게 복원", "색감까지 복원"],
                "color_style": ["화사하게", "따뜻하게", "선명하게"],
                "cleanup_level": ["자연스럽게", "깔끔하게", "배경만 정리"],
                "smile_level": ["살짝 밝게", "부드러운 미소", "자연스러운 표정"],
                "clothes_fix": ["주름만 정리", "먼지까지 정리", "깔끔한 촬영 느낌"],
                "group_face_fix": ["전체 균일하게", "얼굴 밝게", "자연스럽게"],
                "sky_style": ["맑고 화사하게", "파란 하늘", "노을 느낌"],
                "studio_light": ["부드러운 조명", "밝은 사진관", "고급 프로필"],
                "retouch_style": ["화사한 프로필", "필름 감성", "광고 포스터 느낌"],
            }.get(key, []),
            "default_value": default_values.get(key, ""),
            "required": True,
            "helper_text": None,
        }
        for key in visible_user_fields
    ]

    if template is None:
        template = PromptTemplate(
            id=template_id,
            category_id=category.id,
            name=name,
            description=description,
            thumbnail_url=None,
            base_prompt=base_prompt,
            variables=variables,
            default_values=default_values,
            negative_terms=SAFE_NEGATIVE_TERMS,
            recommended_age="전체",
            locale_labels={"seed_slug": seed_slug, "required_source_count": 2 if name == "없는 사람 추가하기" else 1},
            requires_source_photo=True,
            aspect_ratio=aspect_ratio,
            visible_user_fields=visible_user_fields,
            is_public=True,
            is_active=True,
            is_recommended=index <= 3,
            example_image_url=None,
        )
        db.add(template)
        await db.flush()
    else:
        template.category_id = category.id
        template.description = description
        template.thumbnail_url = None
        template.base_prompt = base_prompt
        template.variables = variables
        template.default_values = default_values
        template.negative_terms = SAFE_NEGATIVE_TERMS
        template.recommended_age = "전체"
        template.locale_labels = {"seed_slug": seed_slug, "required_source_count": 2 if name == "없는 사람 추가하기" else 1}
        template.requires_source_photo = True
        template.aspect_ratio = aspect_ratio
        template.visible_user_fields = visible_user_fields
        template.is_public = True
        template.is_active = True
        template.is_recommended = index <= 3
        template.example_image_url = None

    version_result = await db.execute(
        select(PromptTemplateVersion).where(
            PromptTemplateVersion.template_id == template.id,
            PromptTemplateVersion.version_number == 1,
        )
    )
    version = version_result.scalar_one_or_none()
    if version is None:
        db.add(
            PromptTemplateVersion(
                id=_uuid(f"retouch-version:{seed_slug}:1"),
                template_id=template.id,
                version_number=1,
                base_prompt=base_prompt,
                variables=variables,
                default_values=default_values,
                negative_terms=SAFE_NEGATIVE_TERMS,
            )
        )
    else:
        version.base_prompt = base_prompt
        version.variables = variables
        version.default_values = default_values
        version.negative_terms = SAFE_NEGATIVE_TERMS


async def _ensure_retouch_defaults(db: AsyncSession) -> None:
    categories: dict[str, Category] = {}
    for slug, name, description, sort_order in RETOUCH_TEMPLATE_CATEGORIES:
        categories[slug] = await _upsert_category(db, slug, name, description, sort_order, kind="retouch")

    active_template_ids = [
        _uuid(f"retouch-template:{category_slug}:{name}")
        for category_slug, name, *_rest in RETOUCH_TEMPLATE_CARDS
    ]
    per_category_index: dict[str, int] = {slug: 0 for slug, *_rest in RETOUCH_TEMPLATE_CATEGORIES}
    for category_slug, name, goal, details, output, aspect_ratio, visible_user_fields, default_values in RETOUCH_TEMPLATE_CARDS:
        per_category_index[category_slug] += 1
        await _upsert_retouch_template(
            db,
            category=categories[category_slug],
            index=per_category_index[category_slug],
            name=name,
            goal=goal,
            details=details,
            output=output,
            aspect_ratio=aspect_ratio,
            visible_user_fields=visible_user_fields,
            default_values=default_values,
        )

    stale_result = await db.execute(
        select(PromptTemplate)
        .join(Category, PromptTemplate.category_id == Category.id)
        .where(
            Category.kind == "retouch",
            PromptTemplate.id.not_in(active_template_ids),
        )
    )
    for template in stale_result.scalars().all():
        template.is_active = False
        template.is_public = False


async def _ensure_creative_defaults(db: AsyncSession) -> None:
    result = await db.execute(select(func.count(CreativeAsset.id)))
    if int(result.scalar_one() or 0) > 0:
        return

    db.add_all(
        [
            CreativeAsset(asset_type="frame", name="polaroid", label="폴라로이드", payload={"borderColor": "#FFFDF8", "shadow": True}, sort_order=1),
            CreativeAsset(asset_type="frame", name="storybook", label="동화 테두리", payload={"borderColor": "#F2B8A2", "radius": 24}, sort_order=2),
            CreativeAsset(asset_type="sticker", name="heart", label="하트", payload={"text": "♡", "color": "#F472B6"}, sort_order=1),
            CreativeAsset(asset_type="sticker", name="star", label="별", payload={"text": "★", "color": "#FACC15"}, sort_order=2),
            CreativeAsset(asset_type="emoji", name="smile", label="웃음", payload={"text": "^^"}, sort_order=1),
            CreativeAsset(asset_type="emoji", name="cheer", label="응원", payload={"text": "화이팅"}, sort_order=2),
        ]
    )


async def _ensure_preset_defaults(db: AsyncSession) -> None:
    result = await db.execute(select(func.count(AdjustmentPreset.id)))
    if int(result.scalar_one() or 0) > 0:
        return

    db.add_all(
        [
            AdjustmentPreset(name="warm", label="따뜻한", css_filter="brightness(1.1) saturate(1.25) sepia(0.18)", sort_order=1),
            AdjustmentPreset(name="cool", label="시원한", css_filter="brightness(1.05) saturate(0.92) hue-rotate(12deg)", sort_order=2),
            AdjustmentPreset(name="happy", label="화사한", css_filter="brightness(1.18) saturate(1.35) contrast(1.06)", sort_order=3),
            AdjustmentPreset(name="soft-film", label="필름", css_filter="brightness(1.04) saturate(0.82) sepia(0.22) contrast(0.94)", sort_order=4),
        ]
    )


async def _repair_missing_template_previews(db: AsyncSession) -> None:
    preview_by_name = _preview_urls_by_template_name()
    preview_aliases = {
        **{name: name for name in preview_by_name},
        **LEGACY_TEMPLATE_PREVIEW_ALIASES,
    }

    for template_name, canonical_name in preview_aliases.items():
        preview_url = preview_by_name.get(canonical_name)
        if not preview_url:
            continue

        result = await db.execute(
            select(PromptTemplate).where(
                PromptTemplate.name == template_name,
                func.coalesce(PromptTemplate.thumbnail_url, "").not_like("/template-previews/%"),
            )
        )
        for template in result.scalars().all():
            template.thumbnail_url = preview_url
            template.example_image_url = preview_url

    for template_name, preview_url in CUSTOM_TEMPLATE_PREVIEW_URLS.items():
        result = await db.execute(select(PromptTemplate).where(PromptTemplate.name == template_name))
        for template in result.scalars().all():
            if template.thumbnail_url != preview_url or template.example_image_url != preview_url:
                template.thumbnail_url = preview_url
                template.example_image_url = preview_url


async def _deactivate_legacy_default_templates(db: AsyncSession) -> None:
    default_id_by_name = _template_ids_by_template_name()
    default_names = list(default_id_by_name)
    default_ids = list(default_id_by_name.values())

    legacy_result = await db.execute(
        select(PromptTemplate).where(PromptTemplate.name.in_(list(LEGACY_TEMPLATE_PREVIEW_ALIASES)))
    )
    for template in legacy_result.scalars().all():
        template.is_active = False
        template.is_public = False

    duplicate_result = await db.execute(
        select(PromptTemplate).where(
            PromptTemplate.name.in_(default_names),
            PromptTemplate.id.not_in(default_ids),
        )
    )
    for template in duplicate_result.scalars().all():
        template.is_active = False
        template.is_public = False


async def ensure_ai_defaults(db: AsyncSession) -> None:
    await _repair_missing_template_previews(db)
    await _deactivate_legacy_default_templates(db)

    category_slugs = [slug for slug, _name, _description, _sort_order in KID_TEMPLATE_CATEGORIES]
    result = await db.execute(
        select(func.count(PromptTemplate.id))
        .join(Category, PromptTemplate.category_id == Category.id)
        .where(
            Category.slug.in_(category_slugs),
            PromptTemplate.is_public.is_(True),
            PromptTemplate.is_active.is_(True),
        )
    )
    existing_template_count = int(result.scalar_one() or 0)
    legacy_slugs = ["fairy-tale", "cute-character", "photo-card", "kids-ad-poster"]
    legacy_active = await db.execute(
        select(func.count(Category.id)).where(Category.slug.in_(legacy_slugs), Category.is_active.is_(True))
    )
    required_active = await db.execute(
        select(func.count(Category.id)).where(Category.slug.in_(category_slugs), Category.is_active.is_(True))
    )
    old_template_names = ["인물 동화 변신", "아이가 여름 바다 목욕놀이 포스터 만들기"]
    old_active = await db.execute(
        select(func.count(PromptTemplate.id)).where(
            PromptTemplate.name.in_(old_template_names),
            PromptTemplate.is_active.is_(True),
        )
    )
    missing_active_previews = await db.execute(
        select(func.count(PromptTemplate.id))
        .join(Category, PromptTemplate.category_id == Category.id)
        .where(
            Category.slug.in_(category_slugs),
            PromptTemplate.is_public.is_(True),
            PromptTemplate.is_active.is_(True),
            func.coalesce(PromptTemplate.thumbnail_url, "").not_like("/template-previews/%"),
        )
    )
    static_preview_count = await db.execute(
        select(func.count(PromptTemplate.id))
        .join(Category, PromptTemplate.category_id == Category.id)
        .where(
            Category.slug.in_(category_slugs),
            PromptTemplate.is_public.is_(True),
            PromptTemplate.is_active.is_(True),
            PromptTemplate.thumbnail_url.like("/template-previews/%"),
        )
    )

    if (
        existing_template_count >= len(KID_TEMPLATE_CARDS)
        and int(legacy_active.scalar_one() or 0) == 0
        and int(required_active.scalar_one() or 0) == len(KID_TEMPLATE_CATEGORIES)
        and int(missing_active_previews.scalar_one() or 0) == 0
        and int(static_preview_count.scalar_one() or 0) >= len(KID_TEMPLATE_CARDS)
    ):
        await _ensure_retouch_defaults(db)
        await _ensure_creative_defaults(db)
        await _ensure_preset_defaults(db)
        await db.commit()
        return

    legacy_result = await db.execute(select(Category).where(Category.slug.in_(legacy_slugs)))
    for category in legacy_result.scalars().all():
        category.is_active = False

    categories: dict[str, Category] = {}
    for slug, name, description, sort_order in KID_TEMPLATE_CATEGORIES:
        categories[slug] = await _upsert_category(db, slug, name, description, sort_order)

    per_category_index: dict[str, int] = {slug: 0 for slug in category_slugs}
    for category_slug, name, scene, style, details, composition, aspect_ratio in KID_TEMPLATE_CARDS:
        per_category_index[category_slug] += 1
        await _upsert_template(
            db,
            category=categories[category_slug],
            index=per_category_index[category_slug],
            name=name,
            scene=scene,
            style=style,
            details=details,
            composition=composition,
            aspect_ratio=aspect_ratio,
        )

    old_templates = await db.execute(select(PromptTemplate).where(PromptTemplate.name.in_(old_template_names)))
    for template in old_templates.scalars().all():
        template.is_active = False
        template.is_public = False

    await _ensure_creative_defaults(db)
    await _ensure_preset_defaults(db)
    await _ensure_retouch_defaults(db)
    await db.commit()

