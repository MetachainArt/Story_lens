# Story Lens One-Page Style Guide (v2)

> 기준 레퍼런스: Dribbble `5 Minute Journal – Daily Gratitude & Mood Tracker App`  
> URL: https://dribbble.com/shots/25140199-5-Minute-Journal-Daily-Gratitude-Mood-Tracker-App

## 1) Design North Star

**Calm + Warm + Clear**

- Calm: 시선 피로를 줄이는 저채도 웜 톤과 넉넉한 여백
- Warm: 치료적이고 포용적인 감정 톤 유지
- Clear: 큰 터치 타겟, 짧은 문장, 예측 가능한 동선

## 2) Core Rules (Must Keep)

1. 모든 주요 액션 버튼은 `48px` 이상 (`64px` 권장)
2. 텍스트 대비는 WCAG AA (`4.5:1`) 이상
3. 아이콘 단독 사용 금지, 항상 텍스트 라벨 병행
4. 화면당 핵심 액션은 최대 1개(보조 1-2개)
5. 모션은 짧고 부드럽게 (`150-250ms`), 과한 연출 금지

## 3) Visual Token Direction

현재 `frontend/src/styles/design-tokens.css`를 유지하되, 아래 원칙으로 사용 일관성을 강제한다.

### Color Roles

- `--color-bg-light`: 페이지 기본 배경
- `--color-surface`: 카드/패널 배경
- `--color-primary`: 핵심 CTA
- `--color-secondary`: 보조 CTA, 상태 강조
- `--color-text-primary`: 제목/본문 핵심 텍스트
- `--color-text-secondary`: 힌트/보조 텍스트

### Typography Roles

- 페이지 타이틀: `--font-family-serif`, `--font-size-h1`
- 섹션 타이틀: `--font-family-serif`, `--font-size-h2`
- 본문: `--font-family`, `--font-size-body`
- 버튼: `--font-family`, `--font-size-button`, `--font-weight-semibold`

### Spacing Rhythm

- 기본 리듬: `8px` 단위
- 내부 패딩: `--space-md` 또는 `--space-lg`
- 카드 간 간격: `--space-md`
- 섹션 간 간격: `--space-lg` 또는 `--space-xl`

## 4) Component Style Rules

### Primary Button

- 높이: `--button-height-lg` (64px)
- 배경: `--color-primary` (hover: `--color-primary-hover`)
- 모서리: `--radius-2xl`
- 그림자: `--shadow-cute`
- 텍스트: 1줄 고정, 아이콘 + 라벨

### Surface Card

- 배경: `--color-surface`
- 테두리: `1.5px solid --color-border`
- 반경: `--radius-2xl`
- 그림자: `--shadow-sm`

### Field (input/textarea/select)

- 높이: 최소 `48px`
- 배경: `--color-bg-light`
- 테두리: `1.5px solid --color-border`
- 포커스: `:focus-visible` 규칙 강제

### Status Feedback

- 성공: `--color-success`
- 에러: `--color-error`
- 토스트/알림은 하단 고정, 1문장 메시지 우선

## 5) Screen-by-Screen Art Direction

| 화면 | 비주얼 우선순위 | 적용 포인트 | 피해야 할 것 |
|---|---|---|---|
| `/` Home | 큰 CTA와 안정감 | 상단 타이틀 + 2~3개 액션 카드 | 버튼 스타일 혼합 |
| `/camera` | 조작 단순성 | 촬영 버튼만 가장 강하게 강조 | 장식성 오버레이 |
| `/select` | 선택 집중 | 사진 + 다음 액션 2개만 유지 | 정보 과밀 |
| `/edit/:photoId` | 도구 가독성 | 탭/슬라이더 간격 통일, 값 표시 명확 | 과한 글로우/네온 |
| `/write/:photoId` | 읽기/쓰기 편안함 | 본문 line-height 확보, 추천 카드 정리 | 긴 설명문, 복잡한 배경 |
| `/gallery` | 탐색 효율 | 썸네일 카드 일관, 삭제 모달 단순화 | 썸네일 크기 불균형 |
| `/sessions` | 폼 명확성 | 라벨/도움말/에러 상태 표준화 | 색상만으로 상태 전달 |

## 6) Motion and Interaction

- 기본 transition: `--duration-fast` / `--easing-ease-out`
- 패널/모달: `--duration-normal` / `--easing-ease-in-out`
- Hover 효과는 `translateY(-2px)` 이내
- `prefers-reduced-motion` 환경에서는 transform 애니메이션 최소화

## 7) Accessibility Gate (Release Checklist)

- [ ] 주요 버튼/컨트롤 `48px` 이상
- [ ] 텍스트 대비 4.5:1 이상
- [ ] 키보드로 모든 기능 접근 가능
- [ ] `aria-label` 또는 동등한 텍스트 라벨 존재
- [ ] 에러/성공 메시지가 시각 외 방식(텍스트/role)으로도 전달됨

## 8) Apply Order (2-Week)

1. **Week 1**: Home, Write, Sessions에 공통 버튼/필드/카드 규칙 적용
2. **Week 2**: Gallery, Editor로 확장하고 인라인 스타일을 토큰 기반으로 축소

---

문서 버전: `v2.0`  
최종 수정: `2026-02-19`
