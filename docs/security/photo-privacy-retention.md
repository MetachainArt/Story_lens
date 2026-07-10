# 사진 개인정보 및 보관 정책

## 적용 범위

- 사용자가 직접 올린 원본 사진
- 편집 후 저장한 사진
- AI 이미지 생성 및 AI사진보정 결과

## 동의

사진을 새로 저장하거나 외부 AI 제공자에 보내기 전에 계정별 명시적 동의를 받습니다.
AI 기능을 선택한 경우에만 참조 사진을 설정된 AI 제공자에 HTTPS로 전송합니다.
동의 기록에는 서버가 관리하는 정책 버전과 시각을 저장합니다. 정책 버전이 바뀌면 다시 동의해야 합니다.
동의를 철회해도 기존 사진 열람과 수동 삭제는 가능하지만, 새 사진 처리와 AI 처리는 중단됩니다.

## 보관 기간

새 사진에는 생성 시점의 `PHOTO_RETENTION_DAYS`가 기록됩니다. 기본값은 365일입니다.
정책 도입 전에 저장된 사진은 예고 없이 지우지 않도록 만료일이 없는 상태로 유지합니다.
`retention-cleanup` 컨테이너가 만료된 DB 레코드와 로컬 파일을 주기적으로 삭제합니다.

## 운영 확인

```bash
docker compose -f deploy/docker-compose.yml up -d api retention-cleanup
docker compose -f deploy/docker-compose.yml logs -n 50 retention-cleanup
```

정책 문구나 보관 기간을 바꿀 때는 `PRIVACY_POLICY_VERSION`도 함께 올려 재동의를 받습니다.
