#!/usr/bin/env bash
set -euo pipefail
cd /srv/yingyu

echo "🔄 Pulling latest code..."
git fetch --all
git reset --hard origin/main

echo "🧱 Building & starting containers..."
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

echo "🗄️  Running Prisma migrations..."
APP_CID=$(docker compose -f docker-compose.prod.yml ps -q app)
# if prisma is a devDep, move it to dependencies to ensure CLI exists
docker exec -e DATABASE_URL="$(grep -E '^DATABASE_URL' .env.production | cut -d= -f2- || true)" -i "$APP_CID" npx prisma migrate deploy || true

echo "✅ Deploy complete."
