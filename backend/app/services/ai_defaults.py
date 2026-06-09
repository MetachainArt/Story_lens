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


async def _upsert_category(db: AsyncSession, slug: str, name: str, description: str, sort_order: int) -> Category:
    result = await db.execute(select(Category).where(Category.slug == slug))
    category = result.scalar_one_or_none()
    if category is None:
        category = Category(
            id=_uuid(f"category:{slug}"),
            name=name,
            slug=slug,
            kind="template",
            description=description,
            sort_order=sort_order,
            is_active=True,
        )
        db.add(category)
        await db.flush()
        return category

    category.name = name
    category.kind = "template"
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
    result = await db.execute(select(PromptTemplate).where(PromptTemplate.name == name))
    template = result.scalar_one_or_none()
    description = "인물 사진만 올리면 바로 만들 수 있는 어린이용 GPT Image 2 카드예요."
    locale_labels = {"seed_slug": seed_slug, "card_subtitle": composition}

    if template is None:
        template = PromptTemplate(
            id=_uuid(f"template:{seed_slug}"),
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


async def ensure_ai_defaults(db: AsyncSession) -> None:
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
        and int(old_active.scalar_one() or 0) == 0
        and int(static_preview_count.scalar_one() or 0) == len(KID_TEMPLATE_CARDS)
    ):
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
    await db.commit()

