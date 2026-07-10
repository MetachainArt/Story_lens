# Story Lens

사진 편집, AI 이미지 생성, AI사진보정, 글쓰기와 음악 기능을 제공하는 FastAPI + React 서비스입니다.

## Local checks

```powershell
cd frontend
npm ci
npm test -- --reporter=dot
npm run lint
$env:VITE_API_URL='http://localhost:8000'; npm run build
```

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-test.txt
.\.venv\Scripts\python.exe -m pytest
```

DB 통합 테스트에는 이름이 `_test`로 끝나는 전용 PostgreSQL DB를 `TEST_DATABASE_URL`로 지정해야 합니다. 운영 DB를 테스트에 사용하면 실행을 거부합니다.

## Production deploy

운영 서버 `/opt/storylens`에서 다음 순서로 실행합니다.

```bash
git fetch origin
git merge --ff-only origin/main
docker compose -f deploy/docker-compose.yml build api
docker compose -f deploy/docker-compose.yml run --rm init
docker compose -f deploy/docker-compose.yml up -d api retention-cleanup
docker compose -f deploy/docker-compose.yml ps
curl -fsS http://127.0.0.1:8000/health
```

`init`은 Alembic migration과 내장 AI 템플릿 초기화를 한 번에 수행합니다. 기본 사용자나 기본 비밀번호는 만들지 않습니다.

새 설치에서 첫 교사가 필요할 때만 실제 값은 Git에 기록하지 않고 서버 환경변수로 전달한 뒤 실행합니다.

```bash
docker compose -f deploy/docker-compose.yml run --rm \
  -e INITIAL_TEACHER_EMAIL \
  -e INITIAL_TEACHER_NAME \
  -e INITIAL_TEACHER_PASSWORD \
  api python -m app.db.seed
```

## Security operations

- 실제 `.env`와 API 키는 Git에 커밋하지 않습니다.
- 사진은 인증된 `/api/v1/media/...` 경로로만 제공합니다.
- 새 사진은 동의 후 저장되며 기본 보관 기간은 365일입니다.
- 키 교체 절차는 [docs/security/secret-rotation.md](docs/security/secret-rotation.md)를 따릅니다.
- 사진 보관 정책은 [docs/security/photo-privacy-retention.md](docs/security/photo-privacy-retention.md)를 참고합니다.
