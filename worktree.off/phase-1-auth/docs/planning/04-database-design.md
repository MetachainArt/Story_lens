# 데이터베이스 설계서 - Story Lens

> 장애인을 위한 사진 편집 웹 애플리케이션

**작성일**: 2026-02-06
**데이터베이스**: PostgreSQL 14+
**상태**: 설계 완료

---

## 1. 개요

Story Lens는 시각 장애인과 지체 장애인을 위한 접근성 있는 사진 편집 웹 애플리케이션입니다. 본 문서는 애플리케이션의 핵심 데이터 구조와 관계를 정의합니다.

### 주요 설계 원칙
- 사용자 역할 기반 접근 제어 (선생님/학생)
- 편집 이력의 완전한 추적 (감사 로그)
- 유연한 조정 데이터 저장 (JSON)
- 데이터 무결성과 성능 최적화

---

## 2. ER 다이어그램 (텍스트 기반)

```
┌─────────────────────────────────────────────────────────────────┐
│                          USERS                                   │
├─────────────────────────────────────────────────────────────────┤
│ PK  id (UUID)                                                    │
│     name (VARCHAR)                                               │
│     role (ENUM: teacher, student)                                │
│ FK  teacher_id (UUID, nullable) → users.id                       │
│     created_at (TIMESTAMP)                                       │
│     updated_at (TIMESTAMP)                                       │
└─────────────────────────────────────────────────────────────────┘
           │                              │
           │ 1:N                          │ 1:N
           ▼                              ▼
    ┌──────────────────┐        ┌──────────────────┐
    │    PHOTOS        │        │    SESSIONS      │
    ├──────────────────┤        ├──────────────────┤
    │ PK id (UUID)     │        │ PK id (UUID)     │
    │ FK user_id       │        │ FK user_id       │
    │ FK session_id    │        │    location      │
    │    original_url  │        │    date          │
    │    edited_url    │        │    created_at    │
    │    title         │        └──────────────────┘
    │    created_at    │
    │    updated_at    │
    └──────────────────┘
           │
           │ 1:N
           ▼
    ┌──────────────────────┐
    │  EDIT_HISTORY        │
    ├──────────────────────┤
    │ PK id (UUID)         │
    │ FK photo_id          │
    │    filter_name       │
    │    adjustments (JSON)│
    │    crop_data (JSON)  │
    │    created_at        │
    └──────────────────────┘
```

---

## 3. 테이블 정의

### 3.1 users (사용자)

**목적**: 시스템 사용자 관리 (선생님, 학생)

**컬럼 정의**:

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 사용자 고유 ID |
| name | VARCHAR(255) | NOT NULL | 사용자 이름 |
| email | VARCHAR(255) | NOT NULL, UNIQUE | 이메일 주소 |
| password_hash | VARCHAR(255) | NOT NULL | 암호화된 비밀번호 |
| role | ENUM | NOT NULL, DEFAULT 'student' | 역할: teacher, student |
| teacher_id | UUID | FOREIGN KEY, NULLABLE | 담당 선생님 (학생만 해당) |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | 활성 상태 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 가입 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 수정 일시 |

**스키마**:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('teacher', 'student') NOT NULL DEFAULT 'student',
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3.2 photos (사진)

**목적**: 사용자가 업로드한 사진 메타데이터 저장

**컬럼 정의**:

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 사진 고유 ID |
| user_id | UUID | NOT NULL, FOREIGN KEY | 업로드 사용자 |
| session_id | UUID | NOT NULL, FOREIGN KEY | 촬영 세션 |
| original_url | TEXT | NOT NULL | 원본 사진 저장 경로 |
| edited_url | TEXT | NULLABLE | 최종 편집된 사진 경로 |
| title | VARCHAR(255) | NULLABLE | 사진 제목 |
| description | TEXT | NULLABLE | 사진 설명 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 업로드 일시 |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 수정 일시 |

**스키마**:

```sql
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    edited_url TEXT,
    title VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3.3 edit_history (편집 이력)

**목적**: 각 사진의 편집 작업 추적 (감사 로그, 되돌리기 기능)

**컬럼 정의**:

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 편집 이력 ID |
| photo_id | UUID | NOT NULL, FOREIGN KEY | 대상 사진 |
| filter_name | VARCHAR(100) | NULLABLE | 적용된 필터명 (예: sepia, grayscale) |
| adjustments | JSONB | NULLABLE | 조정값 JSON |
| crop_data | JSONB | NULLABLE | 자르기/회전/반전 데이터 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 편집 일시 |

**adjustments JSON 스키마**:

```json
{
  "brightness": -50,
  "saturation": 30,
  "contrast": 20,
  "temperature": 15,
  "sharpness": 10
}
```

**crop_data JSON 스키마**:

```json
{
  "crop": {
    "x": 100,
    "y": 100,
    "width": 500,
    "height": 500
  },
  "rotation": 90,
  "flip": {
    "horizontal": false,
    "vertical": true
  }
}
```

**스키마**:

```sql
CREATE TABLE edit_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    filter_name VARCHAR(100),
    adjustments JSONB,
    crop_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3.4 sessions (촬영 세션)

**목적**: 촬영 활동 단위별 사진 그룹화

**컬럼 정의**:

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| id | UUID | PRIMARY KEY | 세션 고유 ID |
| user_id | UUID | NOT NULL, FOREIGN KEY | 세션 주최자 |
| location | VARCHAR(255) | NULLABLE | 촬영 장소 |
| date | DATE | NOT NULL | 촬영 날짜 |
| title | VARCHAR(255) | NULLABLE | 세션 제목 |
| description | TEXT | NULLABLE | 세션 설명 |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 생성 일시 |

**스키마**:

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location VARCHAR(255),
    date DATE NOT NULL,
    title VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. 인덱스 전략

### 4.1 성능 최적화 인덱스

```sql
-- users 테이블
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_teacher_id ON users(teacher_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- photos 테이블
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_session_id ON photos(session_id);
CREATE INDEX idx_photos_created_at ON photos(created_at DESC);

-- edit_history 테이블
CREATE INDEX idx_edit_history_photo_id ON edit_history(photo_id);
CREATE INDEX idx_edit_history_created_at ON edit_history(created_at DESC);

-- sessions 테이블
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_date ON sessions(date DESC);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
```

### 4.2 복합 인덱스 (자주 함께 조회되는 컬럼)

```sql
-- 사용자별 세션 조회
CREATE INDEX idx_sessions_user_date ON sessions(user_id, date DESC);

-- 세션별 사진 조회
CREATE INDEX idx_photos_session_created ON photos(session_id, created_at DESC);

-- 사용자별 사진 조회
CREATE INDEX idx_photos_user_created ON photos(user_id, created_at DESC);
```

### 4.3 JSONB 인덱스 (필터/조정값 검색)

```sql
-- adjustments 필드 인덱싱
CREATE INDEX idx_edit_history_adjustments ON edit_history USING GIN (adjustments);

-- filter_name과 created_at 복합 조회
CREATE INDEX idx_edit_history_filter ON edit_history(filter_name, created_at DESC);
```

---

## 5. 관계 정의

### 5.1 1:N 관계

#### 사용자 → 사진
- **관계**: 한 사용자는 여러 사진 소유
- **SQL**: `photos.user_id → users.id`
- **제약**: `ON DELETE CASCADE` (사용자 삭제 시 사진 삭제)

#### 사진 → 편집 이력
- **관계**: 한 사진은 여러 편집 작업 이력
- **SQL**: `edit_history.photo_id → photos.id`
- **제약**: `ON DELETE CASCADE` (사진 삭제 시 이력 삭제)

#### 사용자 → 세션
- **관계**: 한 사용자는 여러 촬영 세션
- **SQL**: `sessions.user_id → users.id`
- **제약**: `ON DELETE CASCADE` (사용자 삭제 시 세션 삭제)

#### 세션 → 사진
- **관계**: 한 세션은 여러 사진 포함
- **SQL**: `photos.session_id → sessions.id`
- **제약**: `ON DELETE CASCADE` (세션 삭제 시 사진 삭제)

### 5.2 자가 참조 관계

#### 선생님 → 학생
- **관계**: 선생님은 여러 학생 관리
- **SQL**: `users.teacher_id → users.id`
- **제약**: `ON DELETE SET NULL` (선생님 삭제 시 NULL)
- **설명**: 학생 역할의 사용자만 teacher_id 값 보유

---

## 6. 마이그레이션 전략

### 6.1 초기 마이그레이션 (v1.0)

1. **Phase 1**: 기본 테이블 생성
   - `users` 테이블 생성
   - `sessions` 테이블 생성
   - `photos` 테이블 생성
   - `edit_history` 테이블 생성

2. **Phase 2**: 인덱스 생성
   - 기본 단일 컬럼 인덱스
   - 복합 인덱스
   - JSONB 인덱스

3. **Phase 3**: 초기 데이터 로딩
   - 테스트 사용자 생성
   - 권한 설정

### 6.2 마이그레이션 도구

**권장 도구**: Alembic (Python) 또는 Flyway (Java/Go)

**마이그레이션 파일 구조**:

```
migrations/
├── versions/
│   ├── 001_initial_schema.sql
│   ├── 002_create_indexes.sql
│   └── 003_seed_data.sql
└── env.py
```

### 6.3 데이터 일관성 체크

```sql
-- 참조 무결성 검증
SELECT COUNT(*) FROM photos WHERE user_id NOT IN (SELECT id FROM users);
SELECT COUNT(*) FROM edit_history WHERE photo_id NOT IN (SELECT id FROM photos);
SELECT COUNT(*) FROM users WHERE teacher_id IS NOT NULL
  AND teacher_id NOT IN (SELECT id FROM users WHERE role = 'teacher');

-- 중복 제거
CREATE UNIQUE INDEX idx_users_email ON users(email)
  WHERE is_active = true;
```

---

## 7. 데이터 보안 고려사항

### 7.1 암호화
- **password_hash**: bcrypt 또는 argon2 사용
- **민감한 파일 경로**: 암호화 저장 권장

### 7.2 접근 제어
```sql
-- 역할 기반 접근 제어 (RBAC)
-- 학생은 자신의 사진만 조회 가능
SELECT * FROM photos WHERE user_id = current_user_id;

-- 선생님은 자신의 학생 사진 조회 가능
SELECT * FROM photos p
  JOIN users u ON p.user_id = u.id
  WHERE u.teacher_id = current_teacher_id;
```

### 7.3 감사 로그
- `edit_history` 테이블이 모든 편집 추적
- `created_at` 필드로 타임스탬프 기록

---

## 8. 성능 최적화 팁

### 8.1 쿼리 최적화

```sql
-- 최적: 필요한 컬럼만 선택
SELECT id, user_id, title FROM photos WHERE user_id = $1;

-- 비효율: 모든 컬럼 선택
SELECT * FROM photos WHERE user_id = $1;
```

### 8.2 배치 작업
```sql
-- 여러 사진 한 번에 조회
SELECT * FROM photos WHERE id IN ($1, $2, $3);
```

### 8.3 캐싱 전략
- 사용자 정보: 메모리 캐시 (TTL 1시간)
- 세션 목록: 데이터베이스 직접 조회
- 편집 이력: 사진마다 최대 100개만 메모리 저장

---

## 9. 백업 및 복구

### 9.1 백업 전략
```bash
# 주 1회 전체 백업
pg_dump -U postgres -d story_lens > backup_$(date +%Y%m%d).sql

# 일 1회 차등 백업 (WAL 아카이빙)
```

### 9.2 복구 절차
```bash
# 전체 복구
psql -U postgres -d story_lens < backup_20260206.sql

# 특정 테이블만 복구
pg_restore -U postgres -d story_lens -t photos backup.dump
```

---

## 10. 향후 확장 계획

### 10.1 추가 테이블 (v2.0 예상)
- `notifications`: 알림 저장
- `user_preferences`: 사용자 설정 저장
- `ai_suggestions`: AI 편집 추천 저장

### 10.2 성능 개선
- 읽기 복제(Read Replica) 구성
- 파티셔닝 (photos 테이블 월별)
- 캐싱 레이어 (Redis) 추가

---

## 11. 참고 자료

- PostgreSQL 공식 문서: https://www.postgresql.org/docs/
- UUID 사용 가이드: https://www.postgresql.org/docs/current/uuid-ossp.html
- JSONB 최적화: https://www.postgresql.org/docs/current/datatype-json.html

---

**문서 버전**: 1.0
**마지막 수정**: 2026-02-06
**담당**: 데이터베이스 팀