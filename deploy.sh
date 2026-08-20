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
# The full install, dev dependencies included: the build compiles TypeScript,
# so tsc, tsc-alias, tsx and every @types/* package are needed here. Installing
# with --omit=dev leaves the compiler missing and `npm run build` dies on
# "Could not find a declaration file for module 'express'".
npm ci --no-audit --no-fund >/dev/null
npx prisma generate >/dev/null
# `migrate deploy` only applies committed migrations; it never prompts and
# never drops anything, which is what makes it safe to run unattended.
npx prisma migrate deploy
npm run build >/dev/null
echo "    dist/server.js $( [ -f dist/server.js ] && echo ok || echo MISSING )"

# The service catalog is seed data, not migration data, so it is not applied
# automatically: re-running the seed rewrites prices, and a rate edited in the
# admin UI would silently revert on the next deploy. Seed once on a fresh
# database, by hand:
#     cd /root/visionitinfra/backend && npm run db:seed:services
echo "    service catalog: seed manually with 'npm run db:seed:services' if this is a fresh database"

# The work catalog — what the website shows as recent work — is seed data for
# the same reason, with one difference: a re-run is safe, because it refreshes
# only the facts and leaves copy edited in the studio alone. Pass --rewrite when
# catalog.ts itself has changed and you want that copy pushed over the top.
#     cd /root/visionitinfra/backend && npm run db:seed:catalog
echo "    work catalog: 'npm run db:seed:catalog' (add -- --rewrite to push edited copy)"

step "Checking the PDF renderer"
# Invoice PDFs are rendered by headless Chrome. Two things have to be true, and
# both failed silently on first deploy: `unzip` must exist or the browser
# download extracts to an empty folder, and a font carrying U+20B9 must be
# installed or every rupee amount prints as a blank box.
if ! command -v unzip >/dev/null 2>&1; then
  echo "    installing unzip (required to extract the browser)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends unzip >/dev/null 2>&1 || true
fi

if ! node -e "require('puppeteer').executablePath()" >/dev/null 2>&1 ||
   ! find /root/.cache/puppeteer -name chrome -type f -perm -u+x 2>/dev/null | grep -q .; then
  echo "    Chrome missing — installing"
  npx puppeteer browsers install chrome --install-deps 2>&1 | tail -2
else
  echo "    chrome present"
fi

if [ "$(fc-list ':charset=20b9' 2>/dev/null | wc -l)" -eq 0 ]; then
  echo "    no font with the rupee sign — installing Noto"
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    fonts-noto-core fonts-dejavu-core >/dev/null 2>&1 && fc-cache -f >/dev/null 2>&1 || true
fi
echo "    fonts with U+20B9: $(fc-list ':charset=20b9' 2>/dev/null | wc -l)"

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
