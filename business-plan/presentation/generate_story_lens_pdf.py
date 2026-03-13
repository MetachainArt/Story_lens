from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Frame, Paragraph


BASE_DIR = Path(__file__).resolve().parent.parent
SCREEN_DIR = BASE_DIR / "assets" / "screens"
OUTPUT_PATH = Path(__file__).resolve().parent / "story-lens-public-proposal.pdf"

PAGE_WIDTH = 960
PAGE_HEIGHT = 540


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Malgun", "C:/Windows/Fonts/malgun.ttf"))
    pdfmetrics.registerFont(TTFont("MalgunBold", "C:/Windows/Fonts/malgunbd.ttf"))


def hex_color(value: str) -> colors.Color:
    value = value.lstrip("#")
    return colors.HexColor(f"#{value}")


BG = hex_color("F7F3EE")
SURFACE = hex_color("FFFBF6")
LINE = hex_color("E4D8CA")
INK = hex_color("2E261E")
MUTED = hex_color("65584C")
ACCENT = hex_color("C47550")
ACCENT_DARK = hex_color("A85D3A")
PEACH = hex_color("F5E4D5")
SAGE = hex_color("E4EFE8")
BLUE = hex_color("E7EFF5")


styles = getSampleStyleSheet()
TITLE = ParagraphStyle(
    "TitleKor",
    parent=styles["Title"],
    fontName="MalgunBold",
    fontSize=24,
    leading=30,
    textColor=INK,
    spaceAfter=0,
)
SUBTITLE = ParagraphStyle(
    "SubtitleKor",
    parent=styles["BodyText"],
    fontName="Malgun",
    fontSize=11,
    leading=16,
    textColor=MUTED,
)
BODY = ParagraphStyle(
    "BodyKor",
    parent=styles["BodyText"],
    fontName="Malgun",
    fontSize=11,
    leading=16,
    textColor=MUTED,
)
SMALL = ParagraphStyle(
    "SmallKor",
    parent=styles["BodyText"],
    fontName="Malgun",
    fontSize=9.5,
    leading=13,
    textColor=MUTED,
)
CARD_TITLE = ParagraphStyle(
    "CardTitleKor",
    parent=styles["Heading3"],
    fontName="MalgunBold",
    fontSize=12,
    leading=16,
    textColor=INK,
)


def draw_bg(c: canvas.Canvas) -> None:
    c.setFillColor(BG)
    c.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
    c.setFillColor(colors.Color(0.96, 0.88, 0.83, alpha=0.55))
    c.circle(PAGE_WIDTH - 60, 60, 110, fill=1, stroke=0)
    c.setFillColor(colors.Color(0.89, 0.93, 0.90, alpha=0.6))
    c.circle(120, PAGE_HEIGHT - 70, 90, fill=1, stroke=0)


def rounded(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    fill: colors.Color,
    stroke: colors.Color = LINE,
) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.roundRect(x, y, w, h, 18, fill=1, stroke=1)


def text_block(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    text: str,
    style: ParagraphStyle,
) -> None:
    frame = Frame(
        x,
        y,
        w,
        h,
        showBoundary=0,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
    )
    paragraph = Paragraph(text.replace("\n", "<br/>"), style)
    frame.addFromList([paragraph], c)


def bullets(items: list[str]) -> str:
    return "".join(f"• {item}<br/>" for item in items)


def add_header(c: canvas.Canvas, title: str, subtitle: str, page_no: int) -> None:
    text_block(
        c,
        52,
        PAGE_HEIGHT - 58,
        180,
        20,
        "Story Lens Proposal",
        ParagraphStyle(
            "eyebrow", fontName="MalgunBold", fontSize=10, textColor=ACCENT_DARK
        ),
    )
    text_block(c, 52, PAGE_HEIGHT - 118, 540, 44, title, TITLE)
    text_block(c, 52, PAGE_HEIGHT - 150, 620, 28, subtitle, SUBTITLE)
    c.setStrokeColor(LINE)
    c.setLineWidth(1)
    c.line(52, PAGE_HEIGHT - 164, PAGE_WIDTH - 52, PAGE_HEIGHT - 164)
    text_block(
        c,
        PAGE_WIDTH - 72,
        PAGE_HEIGHT - 58,
        32,
        18,
        f"{page_no:02d}",
        ParagraphStyle(
            "page",
            fontName="MalgunBold",
            fontSize=10,
            alignment=2,
            textColor=ACCENT_DARK,
        ),
    )


def add_footer(c: canvas.Canvas) -> None:
    text_block(
        c,
        52,
        16,
        400,
        16,
        "Story Lens · Icheon pilot proposal",
        ParagraphStyle("footer", fontName="Malgun", fontSize=9, textColor=MUTED),
    )


def image(c: canvas.Canvas, name: str, x: float, y: float, w: float, h: float) -> None:
    path = SCREEN_DIR / name
    if path.exists():
        c.drawImage(
            str(path),
            x,
            y,
            width=w,
            height=h,
            preserveAspectRatio=True,
            anchor="c",
            mask="auto",
        )


def slide_cover(c: canvas.Canvas) -> None:
    draw_bg(c)
    rounded(c, 52, 410, 170, 28, PEACH, PEACH)
    text_block(
        c,
        66,
        416,
        140,
        14,
        "2026 시범사업 검토안",
        ParagraphStyle(
            "pill", fontName="MalgunBold", fontSize=10, textColor=ACCENT_DARK
        ),
    )
    text_block(
        c,
        52,
        308,
        450,
        90,
        "꿈꾸는 카메라 기반<br/>AI 사진·글·음악 창작지원 사업",
        ParagraphStyle(
            "cover", fontName="MalgunBold", fontSize=26, leading=32, textColor=INK
        ),
    )
    text_block(
        c,
        52,
        258,
        380,
        40,
        "이천시청 · 장애인 협회 제안용<br/>Story Lens 기반 디지털 문화복지 시범 프로젝트",
        ParagraphStyle(
            "coverSub", fontName="Malgun", fontSize=13, leading=18, textColor=MUTED
        ),
    )
    rounded(c, 580, 112, 320, 350, SURFACE)
    image(c, "home.png", 598, 128, 284, 320)
    text_block(
        c,
        52,
        132,
        390,
        24,
        "사업 개요",
        ParagraphStyle(
            "sectionLabel", fontName="MalgunBold", fontSize=12, textColor=ACCENT_DARK
        ),
    )
    text_block(
        c,
        52,
        44,
        430,
        78,
        bullets(
            [
                "꿈꾸는 카메라 프로그램 내 장애아동·성인 8명 대상 시범 적용",
                "사진 편집, AI 글쓰기, AI 음악, 사진집 PDF까지 연결",
                "선생님 6명, 복지사 1명과 함께 운영하는 협력 구조",
            ]
        ),
        BODY,
    )


def slide_need(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c,
        "추진 배경 및 필요성",
        "꿈꾸는 카메라에서 우선 검증하고 다른 프로그램으로 확장할 수 있는 디지털 창작 모델",
        2,
    )
    rounded(c, 52, 170, 370, 230, SURFACE)
    text_block(
        c,
        72,
        370,
        180,
        18,
        "현장의 간극",
        ParagraphStyle("smallHead", fontName="MalgunBold", fontSize=13, textColor=INK),
    )
    text_block(
        c,
        72,
        204,
        320,
        150,
        bullets(
            [
                "사진 촬영 활동은 많지만 편집 이후 기록과 결과물화가 약합니다.",
                "참여자가 스스로 완성 경험을 느끼기보다 지도자가 마무리를 대신하는 경우가 많습니다.",
                "디지털 도구가 복잡하고 사진·글·음악·출력물이 분절되어 있습니다.",
            ]
        ),
        BODY,
    )
    rounded(c, 450, 278, 140, 122, PEACH)
    rounded(c, 610, 278, 140, 122, SAGE)
    rounded(c, 770, 278, 138, 122, BLUE)
    text_block(c, 466, 355, 104, 20, "자기표현", CARD_TITLE)
    text_block(
        c, 466, 300, 104, 50, "사진을 통해 감정과 기억을 말하고 싶은 수요", SMALL
    )
    text_block(c, 626, 355, 104, 20, "디지털 포용", CARD_TITLE)
    text_block(c, 626, 300, 104, 50, "AI를 보조도구로 활용한 창작 접근성", SMALL)
    text_block(c, 786, 355, 104, 20, "성과 축적", CARD_TITLE)
    text_block(c, 786, 300, 104, 50, "결과집과 보고자료로 남는 구조", SMALL)
    rounded(c, 450, 170, 220, 86, SURFACE)
    rounded(c, 688, 170, 220, 86, SURFACE)
    text_block(c, 466, 222, 160, 16, "행정 활용성", CARD_TITLE)
    text_block(
        c,
        466,
        184,
        180,
        36,
        "사진집 PDF, 보고자료, 설명자료로 바로 전환 가능한 산출물",
        SMALL,
    )
    text_block(c, 704, 222, 160, 16, "지역 확장성", CARD_TITLE)
    text_block(
        c, 704, 184, 180, 36, "검증 후 다른 프로그램으로 단계적 확장 가능", SMALL
    )
    add_footer(c)


def slide_flow(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c, "사업 운영 구조", "한 장의 사진이 기록과 창작 결과로 이어지는 6단계 흐름", 3
    )
    items = [
        ("① 사진 준비", "촬영 또는 앨범 업로드", PEACH),
        ("② 주제 선택", "추천 키워드 또는 직접 입력", SAGE),
        ("③ 간편 편집", "필터·슬라이더·회전 조정", BLUE),
        ("④ AI 글쓰기", "한 줄 생각 → 최대 5줄 초안", PEACH),
        ("⑤ AI 음악", "스타일 선택 후 음악 생성", SAGE),
        ("⑥ 사진집 제작", "보관함 축적 후 PDF 결과집", BLUE),
    ]
    for idx, (title, desc, fill) in enumerate(items):
        col = idx % 3
        row = idx // 3
        x = 60 + col * 290
        y = 260 - row * 140
        rounded(c, x, y, 250, 98, fill)
        text_block(c, x + 16, y + 62, 190, 16, title, CARD_TITLE)
        text_block(c, x + 16, y + 20, 200, 34, desc, SMALL)
    add_footer(c)


def slide_screens(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(c, "앱 화면 예시", "앱의 주요 흐름을 설명하기 위한 시연 화면 예시", 4)
    positions = [
        ("home.png", 60, 218, 205, 150, "홈 화면"),
        ("gallery-detail.png", 285, 218, 205, 150, "보관함 상세"),
        ("write.png", 510, 218, 205, 150, "AI 글쓰기"),
        ("music.png", 735, 218, 165, 150, "AI 음악 생성"),
    ]
    for name, x, y, w, h, label in positions:
        rounded(c, x, y, w, h, SURFACE)
        image(c, name, x + 8, y + 8, w - 16, h - 26)
        text_block(
            c,
            x,
            y - 18,
            w,
            14,
            label,
            ParagraphStyle(
                "shotLabel",
                fontName="MalgunBold",
                fontSize=10,
                alignment=1,
                textColor=ACCENT_DARK,
            ),
        )
    rounded(c, 60, 72, 840, 82, SURFACE)
    text_block(
        c,
        80,
        92,
        800,
        42,
        "※ 실제 앱은 로그인, 촬영/업로드, 편집, AI 글쓰기, AI 음악, 보관함, 사진집 PDF 흐름이 구현되어 있으며, AI 생성 시간은 외부 서비스 상태에 따라 달라질 수 있습니다.",
        SMALL,
    )
    add_footer(c)


def slide_participants(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c,
        "참여자 지원 관점",
        "아동과 성인 모두가 이해하기 쉬운 단계형 UI와 운영 지원 구조를 전제로 합니다.",
        5,
    )
    cards = [
        (
            60,
            "장애아동 참여자",
            "큰 버튼, 직관적 화면 이동, 사진 한 장에서 출발하는 창작 경험을 통해 자신감을 높입니다.",
            PEACH,
        ),
        (
            330,
            "장애성인 참여자",
            "자신의 기억과 감정을 사진·글·음악으로 연결하는 성취 경험을 제공합니다.",
            SAGE,
        ),
        (
            600,
            "보호자·운영자",
            "결과물을 함께 확인하고 다음 활동으로 이어가기 쉬운 구조를 제공합니다.",
            BLUE,
        ),
    ]
    for x, title, body, fill in cards:
        rounded(c, x, 250, 240, 155, fill)
        text_block(c, x + 16, 360, 180, 16, title, CARD_TITLE)
        text_block(c, x + 16, 280, 190, 70, body, BODY)
    rounded(c, 60, 90, 780, 110, SURFACE)
    text_block(c, 80, 158, 180, 16, "운영 시 고려 포인트", CARD_TITLE)
    text_block(
        c,
        80,
        108,
        740,
        46,
        bullets(
            [
                "참여자별 지원 강도를 다르게 설계합니다.",
                "AI 기능은 외부 서비스 연동이므로 수업 중 대기 시간을 분리해 운영합니다.",
                "선생님·복지사·보호자 협력 구조를 함께 설계합니다.",
            ]
        ),
        SMALL,
    )
    add_footer(c)


def slide_roadmap(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c,
        "10개월 운영 로드맵(안)",
        "꿈꾸는 카메라 운영을 기준으로 한 월별 활동 예시",
        6,
    )
    months = [
        ("3월", "오리엔테이션"),
        ("4월", "봄꽃·감정 기록"),
        ("5월", "풍경과 장소"),
        ("6월", "자연 표현"),
        ("7월", "여름과 움직임"),
        ("8월", "일상 회고"),
        ("9월", "캠핑·야외활동"),
        ("10월", "전통과 문화"),
        ("11월", "AI 창작 집중"),
        ("12월", "회고·사진집"),
    ]
    for idx, (m, t) in enumerate(months):
        col = idx % 5
        row = idx // 5
        x = 60 + col * 175
        y = 270 - row * 120
        rounded(c, x, y, 150, 86, [PEACH, SAGE, BLUE, PEACH, SAGE][col])
        text_block(
            c,
            x + 14,
            y + 50,
            60,
            16,
            m,
            ParagraphStyle(
                "month", fontName="MalgunBold", fontSize=11, textColor=ACCENT_DARK
            ),
        )
        text_block(c, x + 14, y + 20, 112, 28, t, SMALL)
    rounded(c, 60, 86, 840, 36, SURFACE)
    text_block(
        c,
        80,
        96,
        800,
        18,
        "월별 일정 화면은 운영 관리 기능이 아니라 예시형 활동 콘텐츠로 활용하는 것을 권장합니다.",
        ParagraphStyle("roadNote", fontName="Malgun", fontSize=10, textColor=MUTED),
    )
    add_footer(c)


def slide_session(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c,
        "회기 운영 예시",
        "사진 한 장에서 시작해 결과가 남도록 구성한 100분 수업 예시",
        7,
    )
    stages = [
        ("10분", "도입", "오늘의 주제 소개 · 감정 단어 열기"),
        ("25분", "촬영", "현장 또는 앨범 이미지 탐색"),
        ("25분", "편집", "필터·슬라이더·회전 조정"),
        ("20분", "글쓰기", "한 줄 생각 입력 · AI 초안 보조"),
        ("20분", "확장", "AI 음악 또는 결과 공유"),
    ]
    for idx, (time, title, body) in enumerate(stages):
        x = 60 + idx * 170
        rounded(c, x, 270, 145, 148, [PEACH, SAGE, BLUE, PEACH, SAGE][idx])
        text_block(
            c,
            x + 12,
            385,
            60,
            16,
            time,
            ParagraphStyle(
                "time", fontName="MalgunBold", fontSize=10, textColor=ACCENT_DARK
            ),
        )
        text_block(c, x + 12, 350, 100, 16, title, CARD_TITLE)
        text_block(c, x + 12, 284, 116, 54, body, SMALL)
    rounded(c, 600, 72, 300, 140, SURFACE)
    image(c, "gallery-detail.png", 612, 88, 120, 108)
    text_block(
        c,
        740,
        114,
        142,
        64,
        "운영자는 보관함 상세 화면을 통해 사진·글·음악을 함께 확인하며 참여자의 변화와 성취를 점검할 수 있습니다.",
        SMALL,
    )
    add_footer(c)


def slide_impact(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c,
        "기대 효과 및 산출물",
        "참여자, 가족, 기관 모두에게 남는 결과를 정리합니다.",
        8,
    )
    cards = [
        (
            60,
            "참여자 변화",
            "사진을 통해 감정을 표현하고, 글과 음악으로 확장하는 자기표현 경험",
            PEACH,
        ),
        (
            330,
            "가족과 보호자",
            "눈으로 확인 가능한 결과물과 사진집이 가족 공유 자료가 됨",
            SAGE,
        ),
        (
            600,
            "기관 성과",
            "전시·보고서·발표 자료로 활용할 수 있는 시각적 성과 확보",
            BLUE,
        ),
    ]
    for x, title, body, fill in cards:
        rounded(c, x, 270, 240, 145, fill)
        text_block(c, x + 16, 376, 180, 16, title, CARD_TITLE)
        text_block(c, x + 16, 300, 190, 60, body, SMALL)
    rounded(c, 60, 72, 420, 140, SURFACE)
    text_block(c, 80, 184, 120, 16, "대표 산출물(안)", CARD_TITLE)
    text_block(
        c,
        80,
        114,
        360,
        58,
        bullets(
            [
                "사진·글·음악 연계 결과물 48건 목표",
                "개인 또는 공동 사진집 PDF 1종 이상",
                "성과공유회 또는 전시용 인쇄물 제작",
            ]
        ),
        SMALL,
    )
    image(c, "home.png", 510, 78, 360, 126)
    add_footer(c)


def slide_kpi(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(c, "성과지표(KPI) 제안", "시범사업 평가에 활용할 수 있는 기본 지표", 9)
    items = [
        ("직접 참여", "8명", "장애아동 및 성인"),
        ("운영 협력", "7명", "선생님 6 + 복지사 1"),
        ("1인당 결과물", "6건+", "사진 또는 연계 창작물"),
        ("긍정 응답", "80%+", "참여자·보호자 의견"),
    ]
    for idx, (title, value, desc) in enumerate(items):
        x = 60 + idx * 215
        rounded(c, x, 250, 185, 145, [PEACH, SAGE, BLUE, PEACH][idx])
        text_block(
            c,
            x + 12,
            366,
            160,
            16,
            title,
            ParagraphStyle(
                "kpiTitle",
                fontName="MalgunBold",
                fontSize=11,
                textColor=ACCENT_DARK,
                alignment=1,
            ),
        )
        text_block(
            c,
            x + 12,
            314,
            160,
            34,
            f"<para align='center'><font name='MalgunBold' size='22'>{value}</font></para>",
            BODY,
        )
        text_block(
            c, x + 12, 284, 160, 22, f"<para align='center'>{desc}</para>", SMALL
        )
    rounded(c, 60, 80, 840, 110, SURFACE)
    text_block(
        c,
        80,
        116,
        800,
        50,
        "본 지표는 시범사업 제안 기준이며, 실제 운영 시 기관 목표와 예산 조건에 따라 조정 가능합니다. AI 생성 기능은 외부 서비스 상태에 따라 시간이 달라질 수 있으므로 성공률과 소요 시간도 함께 기록하는 것을 권장합니다.",
        SMALL,
    )
    add_footer(c)


def slide_budget(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c,
        "예산 총괄(추정안)",
        "총 사업비 14,000,000원 기준 · 꿈꾸는 카메라 1차 적용 가정",
        10,
    )
    rounded(c, 60, 255, 220, 140, PEACH)
    text_block(c, 82, 370, 150, 16, "총 사업비(추정)", CARD_TITLE)
    text_block(
        c,
        78,
        318,
        180,
        34,
        f"<para align='center'><font name='MalgunBold' size='22'>14,000,000원</font></para>",
        BODY,
    )
    rows = [
        ("운영기획 및 코디네이션", "3,000,000원"),
        ("프로그램 운영비", "2,400,000원"),
        ("결과물 제작비", "2,800,000원"),
        ("플랫폼·AI 기본 운영비", "2,080,000원"),
        ("웹 확장 대응 및 유지보수비", "2,500,000원"),
        ("예비비", "1,220,000원"),
    ]
    rounded(c, 310, 220, 590, 175, SURFACE)
    y = 360
    for name, value in rows:
        text_block(c, 330, y, 330, 14, name, SMALL)
        text_block(c, 690, y, 180, 14, f"<para align='right'>{value}</para>", SMALL)
        y -= 24
    rounded(c, 60, 78, 840, 100, SURFACE)
    text_block(
        c,
        80,
        112,
        800,
        48,
        bullets(
            [
                "이천시청 지원금 10,000,000원(안)",
                "협회/운영기관 분담 2,500,000원(안)",
                "후원·협찬 연계 1,500,000원(안)",
                "서버 100만원/년, AI 약 9만원/월 기준이며 확장 시 비용 증가 가능",
            ]
        ),
        SMALL,
    )
    add_footer(c)


def slide_roles(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c, "협력 구조와 역할 분담", "공공재원, 협회 운영, 실무 실행이 나뉘는 구조", 11
    )
    cards = [
        (60, "이천시청", "사업비 지원, 공공 협력, 지역 확산, 성과 보고 연계", PEACH),
        (
            330,
            "장애인 협회 및 복지기관",
            "참여자 모집, 현장 운영, 보호자 소통, 일정 협력",
            SAGE,
        ),
        (600, "운영팀", "교육 설계, 앱 운영, 결과집 제작", BLUE),
    ]
    for x, title, body, fill in cards:
        rounded(c, x, 255, 240, 140, fill)
        text_block(c, x + 16, 360, 180, 16, title, CARD_TITLE)
        text_block(c, x + 16, 300, 190, 52, body, SMALL)
    rounded(c, 100, 98, 760, 84, SURFACE)
    text_block(
        c,
        120,
        135,
        720,
        28,
        "권장 운영 형태: 꿈꾸는 카메라 현장 운영 + 협회 협력 + 시청 지원 + 향후 프로그램 확장",
        ParagraphStyle(
            "rolesLine", fontName="MalgunBold", fontSize=13, alignment=1, textColor=INK
        ),
    )
    add_footer(c)


def slide_close(c: canvas.Canvas) -> None:
    draw_bg(c)
    add_header(
        c,
        "제안 요약 및 검토 요청",
        "사진 한 장에서 시작하는 디지털 문화복지 시범사업",
        12,
    )
    rounded(c, 60, 180, 500, 220, SURFACE)
    text_block(c, 82, 372, 180, 16, "왜 Story Lens인가", CARD_TITLE)
    text_block(
        c,
        82,
        220,
        440,
        138,
        bullets(
            [
                "사진 편집, AI 글쓰기, AI 음악, 사진집 제작까지 실제 구현된 흐름을 기반으로 함",
                "장애아동과 성인이 자기표현 결과를 직접 완성하는 경험을 중심에 둠",
                "성과물이 눈에 보이기 때문에 공공기관 보고와 지역 확산에 적합함",
                "시범사업 운영 후 타 프로그램으로 단계적 확장 가능",
            ]
        ),
        BODY,
    )
    rounded(c, 595, 180, 305, 220, PEACH)
    text_block(c, 617, 372, 180, 16, "검토 요청 사항", CARD_TITLE)
    text_block(
        c,
        617,
        226,
        240,
        132,
        bullets(
            [
                "꿈꾸는 카메라 1차 적용 예산 구조 검토",
                "운영기관·협회 역할 분담 확정",
                "참여자 8명 기준 운영안 확정",
                "확장 시 웹 운영비·AI 비용 증가 구조 논의",
            ]
        ),
        BODY,
    )
    text_block(
        c,
        60,
        96,
        840,
        26,
        "제안서, 예산안, 앱 매뉴얼, 실제 앱 스크린샷을 함께 제시하여 협의용 설명 자료로 바로 활용할 수 있도록 구성했습니다.",
        ParagraphStyle(
            "closeNote", fontName="Malgun", fontSize=12, alignment=1, textColor=MUTED
        ),
    )
    add_footer(c)


SLIDES = [
    slide_cover,
    slide_need,
    slide_flow,
    slide_screens,
    slide_participants,
    slide_roadmap,
    slide_session,
    slide_impact,
    slide_kpi,
    slide_budget,
    slide_roles,
    slide_close,
]


def build_pdf() -> Path:
    register_fonts()
    c = canvas.Canvas(str(OUTPUT_PATH), pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    for slide in SLIDES:
        slide(c)
        c.showPage()
    c.save()
    return OUTPUT_PATH


if __name__ == "__main__":
    path = build_pdf()
    print(path)
