# Editor Page Tests

## Overview
편집 화면(/edit/:photoId)의 테스트 스위트입니다.

## Test Files

### 1. EditorPage.test.tsx (단위 테스트)
19개 테스트 - 개별 기능 검증

**Photo Loading (4 tests)**
- Photo details API 호출
- Filters API 호출
- Loading spinner 표시
- Error handling

**Tab Navigation (3 tests)**
- 3개 탭 렌더링 (필터/조절/자르기)
- 기본 필터 탭 활성
- 탭 전환

**Filter Panel (2 tests)**
- 5개 필터 카드 렌더링
- 선택된 필터 하이라이트

**Adjustment Panel (2 tests)**
- 5개 슬라이더 렌더링
- 슬라이더 값 변경

**Crop Panel (3 tests)**
- 회전/뒤집기 버튼 렌더링
- 90도 회전
- 좌우 뒤집기

**Save Functionality (3 tests)**
- API 호출 (edit history + photo update)
- /saved로 이동
- Save 실패 에러 처리

**Back Button (1 test)**
- 뒤로 가기 버튼

### 2. EditorIntegration.test.tsx (통합 테스트)
11개 테스트 - 시나리오 기반 워크플로우 검증

**초기 로드 (1 test)**
- 사진 로드 + 필터 탭 활성 + Canvas 렌더링

**필터 적용 (2 tests)**
- 필터 선택 및 카드 강조
- 여러 필터 순차 적용

**슬라이더 조절 (2 tests)**
- 조절 탭 전환 및 밝기 조절
- 여러 슬라이더 동시 조절

**탭 전환 (3 tests)**
- 자르기 탭 전환 및 도구 표시
- 자르기 탭에서 회전/뒤집기
- 3개 탭 간 순환 이동

**저장 (3 tests)**
- 편집 내용 저장 및 API 호출
- 모든 편집 옵션 적용 후 저장
- 저장 중 상태 표시

**Complete Editing Workflow (1 test)**
- 필터 → 조절 → 자르기 → 저장 전체 흐름

## Running Tests

```bash
# Run all editor tests
npm run test src/pages/editor

# Run only unit tests
npm run test src/pages/editor/__tests__/EditorPage.test.tsx

# Run only integration tests
npm run test src/pages/editor/__tests__/EditorIntegration.test.tsx

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Test Setup

**Mocks:**
- API service (`vi.mock('../../../services/api')`)
- Canvas API (`HTMLCanvasElement.prototype.getContext`, `toDataURL`)
- Image loading (`global.Image`)

**Data:**
- Mock photo: `mockPhoto` (photo-123)
- Mock filters: `mockFilters` (5 filters: warm, cool, happy, calm, memory)

## Coverage
- **Total Tests**: 30 (19 unit + 11 integration)
- **Components**: EditorPage, FilterPanel, AdjustmentPanel, CropPanel
- **Store**: useEditorStore (Zustand)
- **APIs**: GET /api/v1/photos/:id, GET /api/filters, POST /api/photos/:id/edits, PUT /api/v1/photos/:id
