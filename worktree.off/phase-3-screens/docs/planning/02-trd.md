# TRD (기술 요구사항 문서) - Story Lens

> 장애인을 위한 사진 편집 웹 앱 기술 명세서

**프로젝트명**: Story Lens
**문서 버전**: 1.0
**작성일**: 2026-02-06
**사용자 레벨**: L2 (일반인)
**기술 결정 방식**: AI 권장사항 수용

---

## 1. 기술 스택 개요

### 선택된 기술 스택

| 레이어 | 기술 | 버전 | 사유 |
|--------|------|------|------|
| **Frontend** | React + Vite | React 19, Vite 6 | 큰 생태계, 이미지 편집 UI에 유리, 컴포넌트 기반 |
| **Backend** | FastAPI | Python 3.11+ | 빠른 성능, 자동 문서화, 향후 AI 기능(스토리/음악 생성) |
| **Database** | PostgreSQL | 15+ | 신뢰성 높음, 무료, 구조화된 데이터에 최적 |
| **Image Processing** | Canvas API + 라이브러리 | HTML5 | 브라우저 기반 처리, 낮은 레이턴시 |
| **Camera Access** | WebRTC / MediaDevices API | 표준 | 크로스 브라우저 호환성 |

### 기술 스택 선택 근거

#### Frontend: React + Vite 선택 이유
- **생태계 규모**: 이미지 편집용 라이브러리 (Konva.js, Fabric.js, Pixijs 등) 풍부
- **컴포넌트 기반**: UI 재사용성 높음, 접근성 개선 용이
- **개발 속도**: Vite 번들러로 빠른 개발 경험 제공
- **성능**: SPA 방식으로 부드러운 사용자 경험

#### Backend: FastAPI 선택 이유
- **성능**: 높은 처리량, 낮은 레이턴시
- **자동 문서화**: Swagger/ReDoc 자동 생성
- **Python 생태계**:
  - 이미지 처리 (OpenCV, Pillow)
  - AI/ML (TensorFlow, PyTorch 활용 가능성)
  - 음악/스토리 생성 라이브러리
- **비동기 지원**: 동시 요청 처리 용이

#### Database: PostgreSQL 선택 이유
- **신뢰성**: ACID 준수, 데이터 무결성 보장
- **확장성**: JSONB 타입으로 유연한 데이터 구조
- **비용**: 무료 오픈소스
- **구조**: 사용자/사진/편집 히스토리 등 관계형 데이터에 최적

---

## 2. 시스템 아키텍처 다이어그램 (텍스트 기반)

```
┌─────────────────────────────────────────────────────────────────┐
│                         최종 사용자 (장애인)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐     ┌──────────┐    ┌──────────┐
   │ Desktop │     │ Tablet   │    │ Mobile   │
   │ Browser │     │ Browser  │    │ Browser  │
   └────┬────┘     └─────┬────┘    └─────┬────┘
        │                │              │
        └────────────────┼──────────────┘
                         │
        ┌────────────────▼────────────────┐
        │   Frontend (React + Vite)       │
        │  ┌────────────────────────────┐ │
        │  │  UI Components             │ │
        │  │  - 사진 촬영 모듈           │ │
        │  │  - 이미지 편집 엔진         │ │
        │  │  - 필터/효과 관리          │ │
        │  │  - 저장/내보내기            │ │
        │  └────────────────────────────┘ │
        │  ┌────────────────────────────┐ │
        │  │  Camera API (WebRTC)        │ │
        │  │  Canvas API (HTML5)         │ │
        │  │  MediaDevices API           │ │
        │  └────────────────────────────┘ │
        └────────────────┬─────────────────┘
                         │
                    HTTP/HTTPS
                    (REST API)
                         │
        ┌────────────────▼─────────────────┐
        │   Backend (FastAPI - Python)     │
        │  ┌────────────────────────────┐  │
        │  │  API Endpoints             │  │
        │  │  - 인증 (auth)              │  │
        │  │  - 사용자 관리              │  │
        │  │  - 사진 업로드/다운로드    │  │
        │  │  - 편집 히스토리           │  │
        │  └────────────────────────────┘  │
        │  ┌────────────────────────────┐  │
        │  │  이미지 처리 모듈           │  │
        │  │  - 필터 적용                │  │
        │  │  - 메타데이터 관리          │  │
        │  │  - 생성 중인 작업 관리      │  │
        │  └────────────────────────────┘  │
        │  ┌────────────────────────────┐  │
        │  │  비즈니스 로직              │  │
        │  │  - 교사 관리                │  │
        │  │  - 권한 검증                │  │
        └────────────────┬────────────────┘
                         │
                    TCP/IP
                  (pg-driver)
                         │
        ┌────────────────▼─────────────────┐
        │   Database (PostgreSQL)          │
        │  ┌────────────────────────────┐  │
        │  │  테이블들                   │  │
        │  │  - users (사용자)           │  │
        │  │  - teachers (교사)          │  │
        │  │  - photos (사진)            │  │
        │  │  - edits (편집 히스토리)   │  │
        │  │  - filters (필터 설정)     │  │
        │  └────────────────────────────┘  │
        └──────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│         파일 저장소 (Local/Cloud)                │
│  - 원본 사진                                      │
│  - 편집된 사진                                    │
│  - 임시 작업 파일                                │
└──────────────────────────────────────────────────┘
```

---

## 3. Frontend 아키텍처

### 3.1 폴더 구조

```
frontend/
├── src/
│   ├── components/
│   │   ├── Camera/           # 카메라 캡처
│   │   ├── ImageEditor/      # 이미지 편집 UI
│   │   ├── Filters/          # 필터 패널
│   │   ├── Adjustments/      # 밝기/대비 등
│   │   ├── Navigation/       # 메뉴/헤더
│   │   └── Common/           # 공통 컴포넌트
│   ├── hooks/                # Custom Hooks
│   ├── services/
│   │   ├── api.js            # API 클라이언트
│   │   ├── camera.js         # 카메라 관리
│   │   └── imageProcessing.js # Canvas 처리
│   ├── store/                # 상태 관리 (Redux/Zustand)
│   ├── styles/               # 스타일시트
│   ├── pages/                # 페이지 컴포넌트
│   └── App.tsx
├── index.html
└── vite.config.ts
```

### 3.2 주요 컴포넌트

#### Camera Component
- WebRTC/MediaDevices API 사용
- 실시간 카메라 프리뷰
- 사진 캡처 기능
- 접근성 고려 (키보드 네비게이션)

#### ImageEditor Component
- Canvas 기반 편집
- 레이어 지원 (선택사항)
- 실시간 미리보기
- Undo/Redo 지원

#### Filters & Adjustments
- 밝기/대비/채도 조정
- 필터 프리셋 (흑백, 세피아 등)
- 이펙트 (블러, 샤프 등)
- 사용자 정의 필터 저장

### 3.3 상태 관리

- **Zustand 또는 Redux**:
  - 현재 이미지 상태
  - 편집 히스토리
  - 필터 설정
  - 사용자 인증 정보

### 3.4 접근성 (Accessibility)

- WAI-ARIA 레이블 적용
- 키보드 네비게이션 지원
- 화면 리더 호환성
- 색상 대비 WCAG AA 준수

---

## 4. Backend 아키텍처

### 4.1 프로젝트 구조

```
backend/
├── app/
│   ├── main.py               # 앱 진입점
│   ├── config.py             # 환경 설정
│   ├── routes/
│   │   ├── auth.py           # 인증
│   │   ├── users.py          # 사용자 관리
│   │   ├── photos.py         # 사진 CRUD
│   │   ├── edits.py          # 편집 히스토리
│   │   └── filters.py        # 필터 관리
│   ├── models/
│   │   ├── database.py       # SQLAlchemy ORM
│   │   ├── schemas.py        # Pydantic 스키마
│   │   └── __init__.py
│   ├── services/
│   │   ├── auth_service.py   # 인증 로직
│   │   ├── photo_service.py  # 사진 처리
│   │   └── filter_service.py # 필터 처리
│   ├── middleware/
│   │   ├── auth.py
│   │   └── error_handler.py
│   └── dependencies.py       # 의존성 주입
├── requirements.txt
├── .env.example
└── run.py
```

### 4.2 API 엔드포인트 개요

#### 인증 (Authentication)
- `POST /auth/login` - 교사 로그인
- `POST /auth/logout` - 로그아웃
- `POST /auth/refresh` - 토큰 갱신

#### 사용자 (Users)
- `GET /users/me` - 현재 사용자 정보
- `GET /users/{id}` - 사용자 조회
- `PUT /users/{id}` - 사용자 수정

#### 사진 (Photos)
- `GET /photos` - 사진 목록
- `GET /photos/{id}` - 사진 상세
- `POST /photos` - 새 사진 업로드
- `PUT /photos/{id}` - 사진 수정
- `DELETE /photos/{id}` - 사진 삭제
- `POST /photos/{id}/download` - 사진 다운로드

#### 편집 히스토리 (Edits)
- `GET /edits/{photo_id}` - 사진의 편집 히스토리
- `POST /edits` - 편집 저장
- `DELETE /edits/{id}` - 편집 되돌리기

#### 필터 (Filters)
- `GET /filters` - 필터 목록
- `POST /filters/apply` - 필터 적용 (서버 사이드)

### 4.3 비동기 작업 처리

```python
# FastAPI + Celery/RQ 활용 (선택사항)
# - 대용량 이미지 처리
# - 배경 작업 큐
# - 작업 진행도 추적
```

### 4.4 에러 처리

```python
class APIError(Exception):
    """기본 API 에러"""
    pass

class AuthenticationError(APIError):
    """인증 실패"""
    pass

class ValidationError(APIError):
    """입력 검증 실패"""
    pass
```

---

## 5. Database 스키마 개요

### 5.1 주요 테이블

#### users (사용자)
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    disability_type VARCHAR(50),
    preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### teachers (교사)
```sql
CREATE TABLE teachers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    institution VARCHAR(255),
    certification_number VARCHAR(255),
    managed_users INTEGER[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### photos (사진)
```sql
CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255),
    file_path VARCHAR(512),
    file_size INTEGER,
    mime_type VARCHAR(50),
    width INTEGER,
    height INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### edits (편집 히스토리)
```sql
CREATE TABLE edits (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action_type VARCHAR(50),
    parameters JSONB,
    thumbnail_path VARCHAR(512),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### filters (필터 설정)
```sql
CREATE TABLE filters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    category VARCHAR(50),
    description TEXT,
    parameters JSONB,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### user_filter_presets (사용자 필터 저장)
```sql
CREATE TABLE user_filter_presets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filter_id INTEGER NOT NULL REFERENCES filters(id),
    custom_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 인덱스 전략

```sql
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_edits_photo_id ON edits(photo_id);
CREATE INDEX idx_edits_user_id ON edits(user_id);
CREATE INDEX idx_users_email ON users(email);
```

---

## 6. API 설계 개요

### 6.1 REST 원칙

- **리소스 중심**: `/users`, `/photos`, `/filters`
- **HTTP 메소드 활용**:
  - `GET`: 조회
  - `POST`: 생성
  - `PUT`: 수정
  - `DELETE`: 삭제
- **상태 코드**:
  - `200`: 성공
  - `201`: 생성됨
  - `400`: 잘못된 요청
  - `401`: 인증 필요
  - `403`: 권한 없음
  - `404`: 찾을 수 없음
  - `500`: 서버 에러

### 6.2 Request/Response 포맷

```json
{
  "status": "success|error",
  "data": {...},
  "message": "Optional message",
  "timestamp": "2026-02-06T00:00:00Z"
}
```

### 6.3 페이징

```
GET /photos?page=1&limit=20&sort=-created_at
```

### 6.4 필터링

```
GET /photos?user_id=1&created_after=2026-01-01
```

---

## 7. 인증 흐름 (교사 관리 방식)

### 7.1 인증 아키텍처

```
┌──────────────┐
│  교사         │
│  로그인      │
└────────┬─────┘
         │
         ▼
┌─────────────────────────────────┐
│  Backend: Auth Endpoint          │
│  - 이메일/비밀번호 검증          │
│  - JWT 토큰 발급                 │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  클라이언트 저장                 │
│  - Access Token (15분)           │
│  - Refresh Token (7일)           │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  API 요청 (헤더)                 │
│  Authorization: Bearer {token}   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Backend: 토큰 검증              │
│  - 서명 확인                      │
│  - 만료 시간 확인                │
│  - 권한 검증                      │
└─────────────────────────────────┘
```

### 7.2 권한 관리

| 역할 | 권한 |
|------|------|
| **교사** | 사용자 등록/관리, 사진 감시, 편집 히스토리 보기 |
| **학생(일반인)** | 자신의 사진만 편집, 자신의 히스토리만 조회 |

### 7.3 토큰 구조 (JWT)

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user_id",
    "email": "teacher@example.com",
    "role": "teacher",
    "iat": 1234567890,
    "exp": 1234571490
  }
}
```

---

## 8. 이미지 처리 전략

### 8.1 브라우저 기반 처리 vs 서버 기반 처리

| 작업 | 위치 | 사유 |
|------|------|------|
| 실시간 필터 미리보기 | 브라우저 | 낮은 레이턴시, 사용자 경험 |
| 기본 필터 (밝기/대비) | 브라우저 | 빠른 응답 |
| 크롭/회전/뒤집기 | 브라우저 | 즉각적인 피드백 |
| 고급 처리 (AI 필터) | 서버 | 무거운 계산 |
| 최종 고해상도 내보내기 | 서버 | 품질 보장 |

### 8.2 브라우저 기반 처리 (Canvas API)

```javascript
// 예시: 밝기 조정
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data;

for (let i = 0; i < data.length; i += 4) {
  data[i] += brightness;     // R
  data[i + 1] += brightness; // G
  data[i + 2] += brightness; // B
  // A는 그대로
}

ctx.putImageData(imageData, 0, 0);
```

### 8.3 라이브러리 활용

- **Fabric.js**: 고급 캔버스 편집
- **Konva.js**: 대화형 2D 렌더링
- **OpenCV.js**: 고급 이미지 처리
- **Pillow (Python)**: 서버 사이드 처리

### 8.4 성능 최적화

- 큰 이미지 리사이징 (Max: 2560x2560)
- WebWorker로 처리 작업 오프로드
- 압축 (JPEG 80% 품질)
- 캐싱 (IndexedDB, Cache API)

---

## 9. 배포 전략

### 9.1 개발 환경

```
Frontend:  http://localhost:5173  (Vite dev server)
Backend:   http://localhost:8000  (FastAPI)
Database:  localhost:5432         (PostgreSQL)
```

### 9.2 프로덕션 환경

#### Frontend 배포
- **호스팅**: Vercel, Netlify, AWS S3 + CloudFront
- **빌드**: `npm run build` → 최적화된 번들
- **CDN**: 글로벌 캐싱

#### Backend 배포
- **호스팅**: AWS EC2, Heroku, Railway, DigitalOcean
- **컨테이너**: Docker 이미지
- **로드 밸런싱**: Nginx, HAProxy
- **자동 확장**: 트래픽 기반

#### Database 배포
- **매니지드 서비스**: AWS RDS, Google Cloud SQL, Azure Database
- **백업**: 자동 일일 백업
- **복제**: 다중 가용성 영역 (Multi-AZ)

### 9.3 배포 파이프라인

```
Code Push
    ↓
Git Webhook
    ↓
CI/CD (GitHub Actions, GitLab CI)
    ├── 테스트 실행
    ├── 빌드
    ├── 보안 스캔
    └── 배포
        ├── Frontend → CDN
        ├── Backend → Container Registry → Production
        └── Database Migration (자동)
```

### 9.4 Docker 구성

```dockerfile
# Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app/ .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 10. 성능 요구사항

### 10.1 응답 시간

| 기능 | 목표 |
|------|------|
| 페이지 로드 | < 3초 |
| 필터 적용 미리보기 | < 500ms |
| 사진 업로드 | < 5초 (10MB 기준) |
| API 응답 | < 200ms |

### 10.2 확장성

- **동시 사용자**: 최소 1,000명
- **데이터베이스**: 1,000만 개 사진 지원
- **저장소**: 1TB 이상

### 10.3 모니터링 및 로깅

- **Application Performance Monitoring (APM)**: New Relic, Datadog
- **로그 수집**: ELK Stack, CloudWatch
- **에러 추적**: Sentry
- **메트릭**: Prometheus, Grafana

---

## 11. 보안 고려사항

### 11.1 인증 & 인가

- **JWT 토큰**: 안전한 생성 및 검증
- **CORS**: 허용된 출처만 접근
- **HTTPS**: 모든 통신 암호화
- **비밀번호**: bcrypt 해싱 (salt 포함)

### 11.2 데이터 보호

- **민감 데이터**: 암호화 저장
- **파일 검증**: MIME 타입 확인, 악성 코드 스캔
- **SQL Injection 방지**: Parameterized Queries (SQLAlchemy ORM)
- **XSS 방지**: 입력 검증, 아웃풋 인코딩

### 11.3 파일 업로드 보안

```python
# 파일 타입 검증
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp'}

def validate_file(filename: str):
    ext = filename.rsplit('.', 1)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("File type not allowed")
```

### 11.4 API 보안

- **Rate Limiting**: 요청 빈도 제한 (DDoS 방지)
- **입력 검증**: Pydantic 스키마
- **출력 검증**: 민감 정보 제거
- **감사 로그**: 모든 중요 작업 기록

### 11.5 의존성 관리

```bash
# 정기적으로 보안 취약점 점검
pip-audit
npm audit
```

---

## 12. 의사결정 로그

| 결정 번호 | 주제 | 선택 | 대안 | 근거 | 날짜 |
|----------|------|------|------|------|------|
| D001 | Frontend 프레임워크 | React + Vite | Vue, Angular, Svelte | 큰 생태계, 이미지 편집 라이브러리 풍부 | 2026-02-01 |
| D002 | Backend 프레임워크 | FastAPI | Django, Flask, Node.js | 빠른 성능, 자동 문서화, Python AI 생태계 | 2026-02-01 |
| D003 | 데이터베이스 | PostgreSQL | MySQL, MongoDB, SQLite | 신뢰성, 관계형 데이터 모델, 무료 | 2026-02-01 |
| D004 | 이미지 처리 위치 | 브라우저 우선 | 서버 기반 | 낮은 레이턴시, 사용자 경험 우선 | 2026-02-02 |
| D005 | 인증 방식 | JWT + 교사 관리 | Session, OAuth | 무상태 확장성, 교사 중심 관리 | 2026-02-02 |
| D006 | 배포 전략 | 클라우드 (AWS/GCP) | On-Premise | 확장성, 유지보수 비용 절감 | 2026-02-03 |
| D007 | 파일 저장소 | Object Storage (S3) | 로컬 서버 | 확장성, 재해 복구, CDN 통합 | 2026-02-03 |
| D008 | 상태 관리 | Zustand | Redux, Context API | 번들 크기 작음, 사용 간편 | 2026-02-04 |

---

## 13. 향후 고려사항

### Phase 2 기능 (선택사항)

- **PWA 지원**: 오프라인 사진 편집
- **실시간 협업**: 여러 사용자 동시 편집
- **AI 기반 필터**: 스타일 전이, 배경 제거
- **음악/스토리 생성**: 사진에 맞는 배경음악
- **음성 명령**: 음성 제어 인터페이스
- **3D 이미지**: 360도 사진 편집

### 보안 강화

- 생체 인식 (지문, 얼굴 인식)
- 2FA (Two-Factor Authentication)
- 엔드-투-엔드 암호화

### 성능 개선

- 서버 사이드 렌더링 (SSR)
- 스트리밍 업로드 (대용량 파일)
- 캐시 최적화

---

## 14. 기술 부채 및 위험 요인

### 14.1 기술 부채

| 항목 | 우려 사항 | 완화 방안 |
|------|----------|----------|
| 의존성 업데이트 | React/FastAPI 버전 관리 | 정기적 보안 패치, 자동화 테스트 |
| 기술 학습 곡선 | 팀 생산성 | 명확한 문서, 코드 리뷰, 멘토링 |
| 레거시 코드 | 유지보수 어려움 | 체계적 리팩토링, 테스트 커버리지 |

### 14.2 위험 요인

| 위험 | 영향 | 가능성 | 대응 |
|------|------|--------|------|
| 데이터 침해 | 높음 | 중간 | 암호화, 보안 감사, 침입 탐지 |
| 성능 저하 | 중간 | 중간 | 성능 테스트, 모니터링, 캐싱 |
| 규정 미준수 | 높음 | 낮음 | GDPR/WCAG 준수, 접근성 테스트 |

---

## 15. 결론

Story Lens는 **React + FastAPI + PostgreSQL** 스택을 기반으로 장애인을 위한 접근성 있는 사진 편집 웹 앱으로 설계되었습니다.

### 핵심 설계 원칙

1. **사용자 중심**: 장애인 친화적 UI/UX
2. **성능**: 브라우저 기반 처리로 낮은 레이턴시
3. **확장성**: 클라우드 기반 배포로 무한 확장
4. **보안**: JWT, HTTPS, 입력 검증 등 다층 방어
5. **유지보수성**: 명확한 아키텍처, 체계적 코드

### 다음 단계

1. **기술 검증 (PoC)**: 핵심 기능 프로토타입
2. **상세 설계**: API 스펙, 데이터베이스 스키마 세부화
3. **개발 시작**: Phase 1부터 단계적 구현
4. **보안 감시**: 정기적 취약점 스캔, 보안 감사

---

**최종 검토**: 기술 의사결정위원회
**승인일**: 2026-02-06
**다음 검토일**: 2026-06-06
