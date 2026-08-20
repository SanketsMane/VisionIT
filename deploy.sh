#!/usr/bin/env bash
#
# Deploys the current main branch on the production host.
#
# Run it ON the server:   bash /root/visionitinfra/deploy.sh
#
# Scoped entirely to this project: it only ever touches /root/visionitinfra and
# the two PM2 processes named below. Other apps on the host are not restarted,
# and nginx is only reloaded if its configuration still tests clean.
set -euo pipefail

APP=/root/visionitinfra
BACKEND_PROC=visionit-backend
FRONTEND_PROC=visionit-frontend

step() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }

cd "$APP"

step "Fetching main"
git fetch --quiet origin
BEFORE=$(git rev-parse --short HEAD)
git reset --hard origin/main --quiet
AFTER=$(git rev-parse --short HEAD)
echo "    $BEFORE -> $AFTER"
[ "$BEFORE" = "$AFTER" ] && echo "    (no new commits — rebuilding anyway)"

step "Backend: install, migrate, build"
cd "$APP/backend"
npm ci --omit=dev --no-audit --no-fund >/dev/null 2>&1 || npm ci --no-audit --no-fund >/dev/null
npm install --no-save typescript tsc-alias >/dev/null 2>&1 || true
npx prisma generate >/dev/null
# `migrate deploy` only applies committed migrations; it never prompts and
# never drops anything, which is what makes it safe to run unattended.
npx prisma migrate deploy
npm run build >/dev/null
echo "    dist/server.js $( [ -f dist/server.js ] && echo ok || echo MISSING )"

step "Frontend: install and build"
cd "$APP/frontend"
npm ci --no-audit --no-fund >/dev/null
npm run build >/dev/null
echo "    .next $( [ -d .next ] && echo ok || echo MISSING )"

step "Restarting this project's processes only"
pm2 restart "$BACKEND_PROC" "$FRONTEND_PROC" --update-env >/dev/null
pm2 save >/dev/null
sleep 5

step "Health check"
for i in $(seq 1 10); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5055/api/v1/health || true)
  WEB=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/login || true)
  [ "$CODE" = "200" ] && [ "$WEB" = "200" ] && break
  sleep 3
done
echo "    api  http://127.0.0.1:5055/api/v1/health -> ${CODE:-000}"
echo "    web  http://127.0.0.1:3100/login         -> ${WEB:-000}"

if [ "${CODE:-000}" != "200" ] || [ "${WEB:-000}" != "200" ]; then
  echo
  echo "    Deploy finished but a health check failed. Recent logs:"
  pm2 logs "$BACKEND_PROC" --lines 20 --nostream || true
  exit 1
fi

step "Done"
pm2 list | grep -E "visionit|name" || true
