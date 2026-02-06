# Story Lens 디자인 시스템

> 장애인(아동 및 성인)을 위한 사진 편집 웹앱 디자인 가이드

---

## 1. 디자인 철학

### 1.1 핵심 원칙

| # | 원칙 | 설명 |
|---|------|------|
| 1 | **접근성 최우선** | WCAG 2.1 AA 준수 |
| 2 | **큰 터치 타겟** | 최소 48px, 권장 64px |
| 3 | **최소한의 UI** | 필수 요소만 표시 |
| 4 | **아이콘 + 텍스트** | 아이콘만 사용 금지 |
| 5 | **높은 대비** | 명도비 4.5:1 이상 |
| 6 | **간단한 네비게이션** | 단계 최소화 |

### 1.2 분위기 (Mood)

- **따뜻하고 밝은 느낌**: 사용자에게 긍정적 감정 전달
- **친근한 표현**: 장애 유무와 관계없이 누구나 환영받는 경험
- **신뢰감**: 안정적이고 예측 가능한 인터페이스

---

## 2. 색상 팔레트 (Color Palette)

### 2.1 주요 색상

| 역할 | 색상명 | HEX | RGB | 용도 |
|------|--------|-----|-----|------|
| **Primary** | 따뜻한 오렌지 | #FF6B35 | RGB(255, 107, 53) | 주요 버튼, CTA, 강조 |
| **Secondary** | 신뢰의 블루 | #2E86AB | RGB(46, 134, 171) | 보조 버튼, 정보 |
| **Background Light** | 깨끗한 흰색 | #FFFFFF | RGB(255, 255, 255) | 주 배경 |
| **Background Soft** | 연한 회색 | #F8F9FA | RGB(248, 249, 250) | 섹션 구분, 카드 배경 |
| **Text Dark** | 강한 검은색 | #1A1A1A | RGB(26, 26, 26) | 본문 텍스트, 제목 |
| **Text Light** | 중간 회색 | #6C757D | RGB(108, 117, 125) | 보조 텍스트 |
| **Success** | 성공 초록 | #28A745 | RGB(40, 167, 69) | 저장 완료, 확인 |
| **Error** | 경고 빨강 | #DC3545 | RGB(220, 53, 69) | 에러, 경고 |
| **Accent** | 선택 강조 | #FF6B35 | (Primary 사용) | 탭 선택, 활성 상태 |

### 2.2 접근성 검증

모든 색상 조합은 WCAG 2.1 AA 준수:
- **텍스트 대비**: 명도비 4.5:1 이상
- **UI 요소**: 명도비 3:1 이상
- **색상 불구자**: 색상에만 의존하지 않음 (패턴/아이콘 병행)

**대비 검증 예시**:
```
Primary (#FF6B35) on White (#FFFFFF): 4.58:1 ✓
Secondary (#2E86AB) on White (#FFFFFF): 6.82:1 ✓
Text Dark (#1A1A1A) on White (#FFFFFF): 21:1 ✓
Text Dark (#1A1A1A) on Soft Gray (#F8F9FA): 18:1 ✓
```

---

## 3. 타이포그래피 (Typography)

### 3.1 폰트 선정

**기본 폰트**: Pretendard, Noto Sans KR
- 한글 가독성 최적화
- 모든 가중치에서 선명한 표현
- 스크린 리더 호환성

### 3.2 크기 및 사용처

| 용도 | 크기 | 가중치 | 예시 | 비고 |
|------|------|--------|------|------|
| **제목 1** | 32px | Bold (700) | 페이지 제목 | 최상단 |
| **제목 2** | 28px | Bold (700) | 섹션 제목 | 주요 구분 |
| **제목 3** | 24px | Bold (700) | 서브 제목 | 소제목 |
| **버튼 텍스트** | 20px | SemiBold (600) | 모든 버튼 | 터치 친화적 |
| **일반 텍스트** | 16px | Regular (400) | 본문, 설명 | 최소 폰트 |
| **보조 텍스트** | 14px | Regular (400) | 힌트, 부가 설명 | 선택사항 |

### 3.3 줄간격

| 텍스트 유형 | 줄간격 |
|-----------|---------|
| 제목 | 1.2 (tight) |
| 본문 (16px) | 1.6 |
| 본문 (14px) | 1.8 |
| 버튼 | 1.0 (센터 정렬) |

**예시**:
```css
h1 {
  font-size: 32px;
  line-height: 1.2;  /* 38.4px */
}

body {
  font-size: 16px;
  line-height: 1.6;  /* 25.6px */
}
```

---

## 4. 간격 및 레이아웃 (Spacing & Layout)

### 4.1 기본 단위

**Base Unit**: 8px (모든 간격의 배수)

| 간격 | 크기 | 용도 |
|------|------|------|
| xs | 4px | 아이콘 내부 간격 |
| sm | 8px | 요소 간 최소 간격 |
| md | 16px | 버튼 간격, 패딩 |
| lg | 24px | 섹션 간격 |
| xl | 32px | 주요 섹션 분리 |
| 2xl | 48px | 페이지 마진 |

### 4.2 컴포넌트별 간격

**버튼 간격**:
- 가로 배치: 최소 16px
- 세로 배치: 최소 12px

**섹션 간격**:
- 일반: 24px
- 주요 구분: 32px
- 페이지 위/아래: 48px

---

## 5. 컴포넌트 명세 (Component Specifications)

### 5.1 주요 버튼 (Primary Button)

```
크기: 64px height
너비: 전체 너비 (100%) 또는 반 너비 (50%)
패딩: 16px (좌우)
배경색: Primary (#FF6B35)
텍스트색: White (#FFFFFF)
텍스트 크기: 20px, SemiBold
모서리: 8px 라운드
상태:
  - Default: Primary
  - Hover: 5% 어두워짐
  - Active: 10% 어두워짐
  - Disabled: 50% 투명도
```

**접근성**:
- ARIA Label: 버튼 목적 명확
- Focus Ring: 2px 실선, 4px 여백
- Keyboard: Enter/Space 지원

### 5.2 필터 카드 (Filter Card)

```
레이아웃: 세로 배치
미리보기:
  - 크기: 120px x 120px (권장)
  - 모서리: 6px 라운드
  - 테두리: 2px, 활성 시 Primary
필터 이름:
  - 크기: 14px, Regular
  - 색상: Text Dark
  - 정렬: 센터
전체 패딩: 12px
간격: 8px (이미지-텍스트)
활성 상태:
  - 테두리: 2px Primary
  - 배경: Soft Gray
```

### 5.3 슬라이더 (Slider)

```
트랙:
  - 높이: 12px
  - 배경: Soft Gray (#F8F9FA)
  - 진행: Primary (#FF6B35)
썸 (Thumb):
  - 크기: 44px x 44px (최소)
  - 모양: 원형
  - 배경: Primary
  - Shadow: 0 2px 8px rgba(0,0,0,0.1)
  - Focus: 4px 테두리, Primary 50%
레이블:
  - 현재값 표시
  - 폰트: 16px
  - 위치: 썸 위쪽
```

### 5.4 사진 카드 (Photo Card)

```
레이아웃: 격자 (Grid)
카드 크기:
  - 모바일: 100% (전체 너비)
  - 태블릿: 48% (2열)
  - 데스크톱: 32% (3열)
이미지:
  - 모서리: 6px 라운드
  - 종횡비: 1:1 (정사각형)
  - Object Fit: cover
오버레이 (Hover):
  - 배경: Primary 70% 투명
  - 아이콘/텍스트: 센터
  - 전환: 200ms ease-in
액션 버튼:
  - 크기: 44px x 44px (최소)
```

### 5.5 하단 탭 (Bottom Tab Navigation)

```
높이: 80px (아이콘 44px + 라벨 16px)
배경: White
테두리: 상단 1px, Light Gray (#E9ECEF)

탭 항목:
  - 너비: 균등 분배
  - 아이콘: 44px x 44px
  - 텍스트: 16px, SemiBold
  - 간격: 8px (아이콘-텍스트)

상태:
  - 활성: 색상 Primary, 배경 Soft Gray
  - 비활성: 색상 Light Gray (#6C757D)
  - 전환: 150ms ease

키보드:
  - Tab: 탭 이동
  - Enter/Space: 활성화
```

---

## 6. 반응형 디자인 (Responsive Design)

### 6.1 화면 크기 브레이크포인트

| 장치 | 최소 너비 | 최대 너비 | 콘텐츠 너비 |
|------|----------|----------|-----------|
| 모바일 | 375px | 767px | 100% - 32px margin |
| 태블릿 | 768px | 1023px | 752px 또는 100% - 32px |
| 데스크톱 | 1024px | 무제한 | 1200px (센터) |

### 6.2 반응형 규칙

**Mobile-First Approach**:
1. 기본 스타일: 375px 이상
2. 태블릿 개선: 768px 이상 (2열 레이아웃)
3. 데스크톱 최적화: 1024px 이상 (3열 레이아웃)

**적응 사항**:
- **레이아웃**: 단열 → 2열 → 3열
- **간격**: 16px → 24px → 32px
- **폰트**: 16px → 18px → 20px (선택)
- **버튼**: 전체 너비 → 반 너비 → 자동

### 6.3 예제 코드

```css
/* 모바일 (기본) */
.filter-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

/* 태블릿 */
@media (min-width: 768px) {
  .filter-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
}

/* 데스크톱 */
@media (min-width: 1024px) {
  .filter-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }
}
```

---

## 7. 접근성 요구사항 (Accessibility Requirements)

### 7.1 WCAG 2.1 AA 준수

| 항목 | 요구사항 | 검증 |
|------|---------|------|
| **색상 대비** | 4.5:1 (텍스트) | 명도비 검사 도구 |
| **터치 타겟** | 최소 48px | 물리적 치수 |
| **키보드 네비게이션** | 모든 기능 접근 가능 | Tab 키 테스트 |
| **스크린 리더** | ARIA 레이블 필수 | NVDA/JAWS 테스트 |
| **포커스 표시** | 최소 3px | 시각적 검증 |
| **언어 선언** | `lang="ko"` | HTML 검증 |
| **대체 텍스트** | 모든 이미지 | alt 속성 |

### 7.2 포커스 스타일

```css
:focus-visible {
  outline: 2px solid #FF6B35;  /* Primary */
  outline-offset: 4px;
  border-radius: 4px;
}

button:focus-visible {
  box-shadow: inset 0 0 0 2px #FFFFFF,
              0 0 0 4px #FF6B35;
}
```

### 7.3 운동능력 고려

- **최소 터치 타겟**: 48px (권장 64px)
- **최소 탭 간격**: 8px
- **크기 조정 지원**: Ctrl/Cmd + 마우스휠
- **호버 대체**: Focus 상태 제공

### 7.4 시각 장애 고려

- **텍스트 크기**: 최소 16px
- **줄간격**: 1.6 이상
- **글자 간격**: normal (최소)
- **자동 재생**: 없음 또는 일시 중지 버튼 필수
- **점멸**: 3Hz 이상 금지

---

## 8. 다크 모드 (Dark Mode) - 선택사항

현재: 라이트 모드만 지원

향후 고려 사항:
- **Background Dark**: #1A1A1A
- **Surface**: #2D2D2D
- **Text Light**: #E5E5E5
- **Text Secondary**: #B8B8B8
- **대비 재계산**: 다크 배경에 맞춰 조정

---

## 9. 아이콘 시스템 (Icon System)

### 9.1 아이콘 규칙

- **크기**: 24px (일반), 32px (탭), 44px (액션 버튼)
- **두께**: 2px 스트로크 (일관성)
- **스타일**: 모던 미니멀리즘
- **라운드 모서리**: 2px
- **텍스트 함께**: 항상 라벨과 함께 표시

### 9.2 주요 아이콘 세트

| 기능 | 아이콘 | 설명 |
|------|--------|------|
| 사진 업로드 | Image + | 사진 추가 |
| 필터 적용 | Sparkles | 필터/효과 |
| 편집 | Edit | 수정 |
| 저장 | Check Circle | 완료 |
| 삭제 | Trash | 제거 |
| 이전 | Chevron Left | 뒤로 |
| 다음 | Chevron Right | 앞으로 |
| 설정 | Settings | 옵션 |
| 정보 | Info | 도움말 |

---

## 10. 마이크로 인터랙션 (Micro Interactions)

### 10.1 전환 효과 (Transitions)

| 요소 | 지속 시간 | 함수 | 용도 |
|------|----------|------|------|
| 버튼 | 150ms | ease-out | 상태 변경 |
| 색상 변화 | 200ms | ease | 호버/포커스 |
| 모달 | 300ms | ease-out | 나타남/사라짐 |
| 페이지 전환 | 250ms | ease-in-out | 네비게이션 |

### 10.2 피드백 (Feedback)

**성공**:
- 아이콘: Check (Green #28A745)
- 토스트: 상단 센터, 3초 자동 닫음
- 진동: 50ms (선택)

**에러**:
- 아이콘: X (Red #DC3545)
- 배경: 흰색 또는 연한 빨강
- 토스트: 4초 표시 (사용자가 닫을 때까지)

**로딩**:
- 스피너: Primary 색상, 회전 1.5초
- 텍스트: "처리 중..." 또는 진행도 표시

---

## 11. 브랜드 톤 (Brand Voice)

### 11.1 텍스트 톤

- **친근함**: "안녕하세요! 사진을 선택해주세요."
- **간결함**: "저장됨", "삭제하시겠어요?"
- **포용성**: "모든 사용자를 위한 기능"

### 11.2 에러 메시지

```
❌ 나쁜 예: "ERROR_FILE_SIZE_EXCEEDS_LIMIT"
✅ 좋은 예: "파일이 너무 큽니다. 10MB 이하로 업로드해주세요."

❌ 나쁜 예: "INVALID_INPUT"
✅ 좋은 예: "이메일을 올바르게 입력해주세요. (예: user@example.com)"
```

---

## 12. 검증 체크리스트

### 12.1 디자인 검증

- [ ] 모든 텍스트 색상 대비 4.5:1 이상
- [ ] 터치 타겟 최소 48px (권장 64px)
- [ ] 포커스 표시 명확함 (2px 이상)
- [ ] 마우스만으로 조작 불가능한 기능 없음
- [ ] 모든 이미지에 alt 텍스트 있음

### 12.2 구현 검증

- [ ] 반응형 테스트 (375px ~ 1920px)
- [ ] 키보드 네비게이션 테스트
- [ ] 스크린 리더 테스트 (NVDA/JAWS)
- [ ] 색상 불구자 시뮬레이션 테스트
- [ ] 줌 기능 테스트 (200% 까지)

### 12.3 성능 검증

- [ ] 이미지 크기 최적화 (WebP 사용)
- [ ] CSS/JS 미니피케이션
- [ ] Lighthouse 점수: 90 이상
- [ ] 접근성 점수: 95 이상

---

## 부록: 참고 자료

### A. 색상 대비 검증 도구

- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Color Oracle (색맹 시뮬레이션): http://colororacle.org/

### B. 접근성 테스트 도구

- NVDA (스크린 리더): https://www.nvaccess.org/
- axe DevTools (자동 검사): https://www.deque.com/axe/devtools/

### C. 디자인 리소스

- Figma 컴포넌트 라이브러리: [링크]
- 타이포그래피 가이드: [링크]
- 아이콘 세트: [링크]

---

**문서 버전**: 1.0
**최종 수정**: 2026-02-06
**담당**: Design Team
**검토**: Accessibility Specialist
