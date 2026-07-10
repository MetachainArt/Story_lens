#!/bin/bash
# Initialize database schema and built-in AI templates.

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
COMPOSE=(
  docker compose
  --env-file "$SCRIPT_DIR/.env.production"
  -f "$SCRIPT_DIR/docker-compose.yml"
)

echo "=== Story Lens DB Init ==="

echo "[1/3] Building API image..."
"${COMPOSE[@]}" build api

echo "[2/3] Running migrations and idempotent AI defaults..."
"${COMPOSE[@]}" run --rm init

echo "[3/3] Starting API and retention worker..."
"${COMPOSE[@]}" up -d api retention-cleanup

echo ""
echo "=== DB initialized without default user credentials. ==="
echo "Create the first teacher only with explicit INITIAL_TEACHER_* variables."
