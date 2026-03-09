#!/bin/bash
# Initialize database: run migrations + seed data
# Run from deploy/ directory after docker compose up -d

set -e

echo "=== Story Lens DB Init ==="

echo "[1/2] Running Alembic migrations..."
docker compose exec api alembic upgrade head

echo "[2/2] Seeding initial data..."
docker compose exec api python -m app.db.seed

echo ""
echo "=== DB initialized! ==="
echo "  - teacher@storylens.com / password123"
echo "  - student1@storylens.com / password123"
