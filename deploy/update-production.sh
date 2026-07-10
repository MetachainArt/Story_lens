#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${STORYLENS_APP_DIR:-/opt/storylens}"
ENV_FILE="${APP_DIR}/deploy/.env.production"
COMPOSE_FILE="${APP_DIR}/deploy/docker-compose.yml"
BACKUP_DIR="${STORYLENS_BACKUP_DIR:-/opt/storylens-backups}"
MIN_FREE_KB="${STORYLENS_MIN_FREE_KB:-3145728}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo bash ${APP_DIR}/deploy/update-production.sh" >&2
  exit 1
fi

cd "${APP_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing production environment file: ${ENV_FILE}" >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing compose file: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "The production worktree has local changes. Review them before deploying." >&2
  git status --short >&2
  exit 1
fi

available_kb="$(df --output=avail -k / | tail -1 | tr -d ' ')"
if (( available_kb < MIN_FREE_KB )); then
  echo "Deployment stopped: less than $((MIN_FREE_KB / 1024 / 1024)) GB is free." >&2
  df -h / >&2
  exit 1
fi

compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
before_commit="$(git rev-parse --short HEAD)"

echo "[1/7] Fetching origin/main"
git fetch origin
git merge --ff-only origin/main
after_commit="$(git rev-parse --short HEAD)"

echo "[2/7] Backing up PostgreSQL"
install -d -m 700 "${BACKUP_DIR}"
timestamp="$(date +%Y%m%d-%H%M%S)"
backup_path="${BACKUP_DIR}/story_lens-${timestamp}.dump"
backup_temp="${backup_path}.tmp"
trap 'rm -f "${backup_temp:-}"' EXIT
"${compose[@]}" exec -T db sh -lc \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "${backup_temp}"
test -s "${backup_temp}"
mv "${backup_temp}" "${backup_path}"
chmod 600 "${backup_path}"

echo "[3/7] Keeping one rollback API image"
if docker image inspect storylens-api:local >/dev/null 2>&1; then
  docker image rm -f storylens-api:rollback >/dev/null 2>&1 || true
  docker tag storylens-api:local storylens-api:rollback
fi

echo "[4/7] Building the API image"
"${compose[@]}" build api

echo "[5/7] Applying migrations and default data"
"${compose[@]}" run --rm -T init </dev/null

echo "[6/7] Starting the API and retention worker"
"${compose[@]}" up -d api retention-cleanup

healthy=false
for _attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "${healthy}" != true ]]; then
  echo "Deployment failed: API health check did not pass." >&2
  "${compose[@]}" logs --tail=120 api >&2
  echo "Database backup: ${backup_path}" >&2
  exit 1
fi

echo "[7/7] Removing safe-to-delete caches"
docker image prune -f >/dev/null
docker builder prune -af >/dev/null
journalctl --vacuum-size=750M >/dev/null 2>&1 || true
apt-get clean

"${compose[@]}" ps
curl -fsS http://127.0.0.1:8000/health
echo
df -h /
echo "Updated: ${before_commit} -> ${after_commit}"
echo "Database backup: ${backup_path}"
sha256sum "${backup_path}"
