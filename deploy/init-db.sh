#!/bin/bash
# Initialize database schema and built-in AI templates.

set -e

echo "=== Story Lens DB Init ==="

echo "[1/3] Building API image..."
docker compose build api

echo "[2/3] Running migrations and idempotent AI defaults..."
docker compose run --rm init

echo "[3/3] Starting API and retention worker..."
docker compose up -d api retention-cleanup

echo ""
echo "=== DB initialized without default user credentials. ==="
echo "Create the first teacher only with explicit INITIAL_TEACHER_* variables."
