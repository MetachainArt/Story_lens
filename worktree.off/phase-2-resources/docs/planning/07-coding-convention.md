# Story Lens - 코딩 규약

> Photo Editing Web App | React + Vite (Frontend), FastAPI + Python (Backend), PostgreSQL (Database)
> 사용자 레벨: L2 (일반인) - 단순하고 명확한 규약

---

## 프로젝트 구조

### Frontend 구조

```
src/
├── components/              # 재사용 가능한 UI 컴포넌트
│   ├── common/              # 공통 컴포넌트 (Button, Slider 등)
│   │   ├── Button.tsx
│   │   ├── Slider.tsx
│   │   └── Modal.tsx
│   ├── camera/              # 카메라 관련 컴포넌트
│   │   ├── CameraPreview.tsx
│   │   └── CameraSettings.tsx
│   ├── editor/              # 편집 관련 컴포넌트
│   │   ├── PhotoEditor.tsx
│   │   ├── ToolPanel.tsx
│   │   └── HistoryPanel.tsx
│   └── gallery/             # 갤러리 관련 컴포넌트
│       ├── PhotoGrid.tsx
│       └── PhotoCard.tsx
├── pages/                   # 페이지 컴포넌트
│   ├── HomePage.tsx
│   ├── CameraPage.tsx
│   ├── EditorPage.tsx
│   └── GalleryPage.tsx
├── hooks/                   # 커스텀 훅
│   ├── usePhoto.ts
│   ├── useEditor.ts
│   └── useCamera.ts
├── utils/                   # 유틸리티 함수
│   ├── image-processor.ts
│   ├── validators.ts
│   └── formatters.ts
├── api/                     # API 호출 함수
│   ├── auth.ts
│   ├── photos.ts
│   └── editor.ts
├── styles/                  # 글로벌 스타일
│   ├── globals.css
│   ├── variables.css
│   └── reset.css
├── types/                   # TypeScript 타입
│   ├── photo.ts
│   ├── user.ts
│   └── api.ts
└── App.tsx
```

### Backend 구조

```
app/
├── api/                     # API 라우터
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── auth.py          # 인증 엔드포인트
│   │   ├── photos.py        # 사진 관련 엔드포인트
│   │   ├── editor.py        # 편집 관련 엔드포인트
│   │   └── gallery.py       # 갤러리 엔드포인트
│   └── __init__.py
├── models/                  # DB 모델 (SQLAlchemy)
│   ├── __init__.py
│   ├── user.py
│   ├── photo.py
│   └── edit_history.py
├── schemas/                 # Pydantic 스키마
│   ├── __init__.py
│   ├── user_schema.py
│   ├── photo_schema.py
│   └── edit_history_schema.py
├── services/                # 비즈니스 로직
│   ├── __init__.py
│   ├── auth_service.py
│   ├── photo_service.py
│   └── editor_service.py
├── core/                    # 설정, 보안
│   ├── __init__.py
│   ├── config.py            # 환경 설정
│   ├── security.py          # 인증 관련
│   └── constants.py         # 상수
├── utils/                   # 유틸리티
│   ├── __init__.py
│   ├── logger.py
│   └── helpers.py
├── __init__.py
└── main.py                  # 애플리케이션 진입점
```

---

## 네이밍 규칙

### Frontend

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `PhotoEditor.tsx`, `CameraPreview.tsx` |
| 함수/변수 | camelCase | `handleSave`, `photoList`, `isLoading` |
| 파일명 (컴포넌트) | PascalCase 또는 kebab-case | `PhotoEditor.tsx` 또는 `photo-editor.tsx` |
| 파일명 (유틸/훅) | kebab-case | `image-processor.ts`, `use-photo.ts` |
| CSS 클래스 | BEM 또는 CSS Modules | `.photo-editor__button` 또는 `PhotoEditor.module.css` |
| 상수 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `TIMEOUT_DURATION` |

### Backend

| 대상 | 규칙 | 예시 |
|------|------|------|
| 함수 | snake_case (PEP 8) | `get_user_by_id()`, `save_photo()` |
| 클래스 | PascalCase | `UserModel`, `PhotoSchema` |
| 변수 | snake_case | `user_id`, `photo_list` |
| 파일명 | snake_case | `auth_service.py`, `photo_model.py` |
| 상수 | UPPER_SNAKE_CASE | `MAX_UPLOAD_SIZE`, `DEFAULT_TIMEOUT` |

### API & Database

| 대상 | 규칙 | 예시 |
|------|------|------|
| API endpoint | snake_case | `/api/v1/photos`, `/api/v1/edit_history` |
| Query parameter | snake_case | `?page=1&sort_by=created_at` |
| DB 컬럼 | snake_case | `created_at`, `user_id`, `photo_name` |
| DB 테이블 | snake_case (plural) | `users`, `photos`, `edit_histories` |

---

## 코드 스타일

### TypeScript 규칙

```typescript
// 1. strict mode 필수 (tsconfig.json)
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// 2. Props 인터페이스 정의
interface PhotoEditorProps {
  photoId: string;
  onSave?: (photo: Photo) => void;
  isLoading?: boolean;
}

const PhotoEditor: React.FC<PhotoEditorProps> = ({
  photoId,
  onSave,
  isLoading = false
}) => {
  // 컴포넌트 로직
};

// 3. Functional Components + Hooks 사용
const usePhotoEditor = (photoId: string) => {
  const [photo, setPhoto] = React.useState<Photo | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // 로직
  }, [photoId]);

  return { photo, error };
};

// 4. 에러 처리
try {
  const response = await savePhoto(photo);
  showNotification('사진이 저장되었습니다.', 'success');
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : '저장 중 오류가 발생했습니다.';
  showNotification(message, 'error');
}

// 5. 주석 - 복잡한 로직에만 작성
// 사진의 색감 보정을 위해 RGB 채널을 개별적으로 처리
const adjustColorBalance = (image: ImageData) => {
  // ...
};
```

### Python 규칙 (PEP 8)

```python
# 1. 함수 및 변수 - snake_case
def get_user_by_id(user_id: int) -> User:
    """사용자 ID로 사용자 정보 조회"""
    pass

# 2. 클래스 - PascalCase
class PhotoSchema(BaseModel):
    id: int
    user_id: int
    file_path: str
    created_at: datetime

# 3. 에러 처리
from fastapi import HTTPException

try:
    photo = await photo_service.get_photo(photo_id)
except PhotoNotFoundError as e:
    raise HTTPException(
        status_code=404,
        detail="사진을 찾을 수 없습니다."
    )

# 4. 타입 힌트 필수
def save_edit_history(
    user_id: int,
    photo_id: int,
    changes: dict[str, Any]
) -> EditHistory:
    """편집 이력 저장"""
    pass

# 5. 주석 - 복잡한 로직에만
# EXIF 데이터에서 이미지 방향 정보를 추출하여 자동 회전 처리
def auto_rotate_image(image_path: str) -> Image:
    pass
```

---

## Git 규약

### Branch 네이밍

```
feature/기능명          # 새 기능 개발
fix/버그명             # 버그 수정
docs/문서명            # 문서 작성
refactor/변경사항      # 코드 리팩토링
style/변경사항         # 스타일 및 포맷팅
```

예시:
```
feature/photo-editor-ui
fix/image-upload-error
docs/api-documentation
refactor/hook-extraction
```

### Commit 메시지 형식

```
<type>: <설명>

<선택적 본문>

<선택적 푸터>
```

Type 종류:
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 추가/수정
- `style`: 코드 스타일 변경 (들여쓰기, 세미콜론 등)
- `refactor`: 코드 리팩토링
- `test`: 테스트 코드 추가/수정
- `chore`: 빌드, 의존성 업데이트 등

예시:
```
feat: 사진 편집 기능 추가

- 밝기, 대비, 채도 조절 기능
- 실시간 프리뷰
- 변경 이력 저장

Closes #123
```

### Pull Request 규칙

- 화면 단위로 PR 생성 (예: 카메라 기능, 편집 기능)
- 제목은 기능 설명 (예: "사진 갤러리 UI 구현")
- 설명에는 변경사항, 스크린샷, 테스트 방법 기재
- 리뷰어 1명 이상 승인 필수

---

## 접근성 규칙

### WCAG 2.1 AA 준수

#### 1. 이미지 대체 텍스트

```typescript
// 나쁜 예
<img src="photo.jpg" />

// 좋은 예
<img
  src="photo.jpg"
  alt="사용자가 편집한 사진 - 봄 풍경"
/>

// 장식용 이미지
<img
  src="decoration.svg"
  alt=""
  aria-hidden="true"
/>
```

#### 2. 키보드 네비게이션

```typescript
// 모든 상호작용 요소는 키보드로 접근 가능
<button
  onClick={handleSave}
  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
>
  저장
</button>

// Tab 순서 관리
<input tabIndex={1} />
<button tabIndex={2}>저장</button>

// 포커스 표시
button:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}
```

#### 3. 터치 타겟 크기

```css
/* 최소 터치 타겟: 48px × 48px */
button {
  min-width: 48px;
  min-height: 48px;
  padding: 12px 16px;
}

/* 아이콘 버튼 */
.icon-button {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

#### 4. 색상 대비

```css
/* 일반 텍스트: 4.5:1 이상 */
.text-normal {
  color: #333333;           /* 명도 13% */
  background-color: #ffffff; /* 명도 100% */
  /* 대비: 12.63:1 */
}

/* 큰 텍스트(18pt 이상): 3:1 이상 */
.text-large {
  font-size: 18px;
  color: #666666;           /* 명도 40% */
  background-color: #ffffff;
  /* 대비: 5.36:1 */
}

/* 나쁜 예 */
.gray-on-white {
  color: #cccccc;           /* 대비: 1.86:1 - 너무 낮음 */
  background-color: #ffffff;
}
```

#### 5. ARIA Label 활용

```typescript
// 버튼 설명 추가
<button
  aria-label="사진 저장"
  title="사진 저장"
>
  <SaveIcon />
</button>

// 폼 레이블
<label htmlFor="brightness-slider">
  밝기 조절
</label>
<input
  id="brightness-slider"
  type="range"
  aria-label="밝기 조절 (0~100)"
/>

// 라이브 영역 (실시간 알림)
<div aria-live="polite" aria-atomic="true">
  {message}
</div>

// 메뉴
<button aria-haspopup="menu" aria-expanded={isOpen}>
  메뉴
</button>
<ul role="menu" hidden={!isOpen}>
  <li role="menuitem">편집</li>
  <li role="menuitem">삭제</li>
</ul>
```

#### 6. 포커스 관리

```typescript
// 모달 열릴 때 포커스 이동
const Modal: React.FC<ModalProps> = ({ isOpen }) => {
  const firstButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      firstButtonRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <dialog open={isOpen}>
      <button ref={firstButtonRef}>확인</button>
      <button>취소</button>
    </dialog>
  );
};
```

#### 7. 스크린 리더 테스트

```typescript
// 숨겨진 텍스트 (스크린 리더만 인식)
const srOnly = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`;

<span className={srOnly}>
  저장 버튼 - 현재 사진
</span>
```

---

## 코딩 체크리스트

### Frontend 체크리스트

- [ ] TypeScript strict mode 활성화
- [ ] Props 인터페이스 정의됨
- [ ] 에러 처리 포함 (try-catch)
- [ ] 사용자 메시지는 한국어
- [ ] 주석은 복잡한 로직에만
- [ ] 모든 이미지에 alt text
- [ ] 키보드 네비게이션 테스트
- [ ] 터치 타겟 48px 이상
- [ ] 색상 대비 4.5:1 이상
- [ ] ARIA label 추가됨

### Backend 체크리스트

- [ ] PEP 8 스타일 준수
- [ ] 타입 힌트 작성됨
- [ ] 에러 처리 및 로깅
- [ ] API 응답 스키마 정의됨
- [ ] 데이터 검증 (Pydantic)
- [ ] 보안 검토 (인증, 인가)
- [ ] DB 마이그레이션 작성됨
- [ ] 단위 테스트 작성됨

---

## 참고 자료

- TypeScript: https://www.typescriptlang.org/docs/
- PEP 8: https://pep8.org/
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- React Best Practices: https://react.dev/
- FastAPI: https://fastapi.tiangolo.com/

---

**최종 수정**: 2026-02-06
