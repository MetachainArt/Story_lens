# Story Lens 운영 업데이트 안내

## 현재 배포 방식

- 프런트엔드: Vercel이 GitHub `main` 브랜치를 감지해 자동 배포합니다.
- 백엔드: OCI 서버의 `/opt/storylens`에서 수동으로 업데이트합니다.
- GitHub Actions: 보안 검사, 프런트엔드 검사, 백엔드 검사만 수행합니다. OCI 서버 배포는 하지 않습니다.

백엔드를 자동 배포하지 않는 이유는 GitHub에 OCI SSH 개인 키와 운영 서버 권한을 추가하지 않았기 때문입니다. 현재는 CI 통과를 확인한 뒤 수동 배포하는 방식이 더 단순하고 안전합니다.

## 가장 쉬운 업데이트 방법

1. GitHub의 `main` 브랜치 CI가 모두 통과했는지 확인합니다.
2. Windows에서 기존 SSH 배치 파일로 OCI 서버에 접속합니다.
3. 다음 두 줄만 실행합니다.

```bash
sudo -i
bash /opt/storylens/deploy/update-production.sh
```

스크립트가 자동으로 다음 작업을 수행합니다.

1. 서버 저장소에 수정 중인 파일이 없는지 검사
2. 최소 3GB의 빈 디스크 공간 확인
3. `origin/main`을 fast-forward 방식으로 적용
4. PostgreSQL 백업 생성
5. 이전 API 이미지를 `storylens-api:rollback`으로 한 개 보관
6. API 이미지 빌드
7. Alembic 마이그레이션과 기본 템플릿 반영
8. API와 사진 보관 기간 정리 워커 재기동
9. 헬스체크와 컨테이너 상태 확인
10. 미사용 이미지·빌드 캐시와 오래된 저널 로그 정리

운영 환경 파일은 `/opt/storylens/deploy/.env.production`이며 Git에 올리면 안 됩니다. DB 백업은 `/opt/storylens-backups`에 생성됩니다.

## 수동 명령이 필요할 때

자동 스크립트를 사용할 수 없을 때만 다음 순서로 실행합니다.

```bash
sudo -i
cd /opt/storylens

git status --short
df -h /
git fetch origin
git merge --ff-only origin/main

docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml build api
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml run --rm -T init </dev/null
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml up -d api retention-cleanup

docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml ps
curl -fsS http://127.0.0.1:8000/health
```

정상이라면 헬스체크 결과가 다음과 같이 나옵니다.

```json
{"status":"healthy"}
```

## 디스크 확인과 안전한 정리

용량 확인:

```bash
df -hT /
df -ih /
docker system df
journalctl --disk-usage
```

사진, DB, Docker 볼륨을 보존하는 안전한 정리:

```bash
sudo journalctl --vacuum-size=750M
docker image prune -f
docker builder prune -af
sudo apt-get clean
df -hT /
```

`docker image prune -f`는 태그가 없는 이미지만 지우므로 배포 스크립트가 남긴 `storylens-api:rollback` 이미지를 보존합니다. 공간이 매우 부족해 미사용 이미지를 모두 지워야 할 때만 `docker image prune -af`를 사용하며, 이 경우 롤백 이미지도 삭제될 수 있습니다.

다음 명령은 사진과 DB를 삭제할 수 있으므로 실행하지 않습니다.

```text
docker compose down -v
docker volume prune
docker system prune --volumes
rm -rf /var/lib/docker
rm -rf /opt/storylens
```

디스크 사용률이 85%를 넘거나 남은 공간이 5GB 미만이면 새 배포 전에 정리합니다. `/home`, `/var/lib/docker/volumes`, `/opt/storylens-backups`는 사용처를 확인하지 않고 삭제하지 않습니다.

## 업데이트가 실패할 때

### Git에 수정 파일이 있다고 나올 때

```bash
cd /opt/storylens
git status --short
```

운영 환경 파일이나 직접 수정한 코드일 수 있으므로 `git reset --hard`를 실행하지 말고 먼저 내용을 확인합니다.

### API가 unhealthy일 때

```bash
cd /opt/storylens
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml ps
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml logs --tail=150 api
docker compose --env-file deploy/.env.production -f deploy/docker-compose.yml logs --tail=100 init
```

오류를 고치기 전까지 같은 배포 명령을 반복 실행하지 않습니다. 스크립트가 출력한 DB 백업 경로와 실패 로그를 함께 확인합니다.

### 공개 주소 확인

```bash
curl -fsS https://api.storylens.dmssolution.co.kr/health
curl -I https://storylens.dmssolution.co.kr/
```

## 완전 자동 배포로 바꾸려면

추후 자동 배포가 필요하면 GitHub Actions에 다음 항목을 별도로 구성해야 합니다.

- OCI 호스트, SSH 사용자, 배포 전용 SSH 개인 키를 GitHub Secrets에 등록
- CI 성공 후에만 실행되는 배포 workflow 추가
- 배포 전 DB 백업과 디스크 여유 공간 검사
- 동시 배포 방지 설정
- 헬스체크 실패 시 알림과 운영자 승인 기반 복구 절차

운영 사진과 DB를 다루므로 단순한 `git pull` 자동 실행이나 주기적인 cron 배포는 사용하지 않습니다.
