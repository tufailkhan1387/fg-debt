#!/usr/bin/env bash
# Runs on the server after GitHub Actions has uploaded the API.
# Installs packages, runs database migrations and (re)starts the API with pm2.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

# Webuzo installs Node.js outside the default PATH; find it if needed.
if ! command -v node >/dev/null 2>&1; then
  for dir in /usr/local/apps/nodejs*/bin /opt/alt/alt-nodejs*/root/usr/bin; do
    if [ -x "$dir/node" ]; then PATH="$dir:$PATH"; fi
  done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found on the server. Install Node.js 24 from Webuzo first." >&2
  exit 1
fi
echo "Using node $(node -v) from $(command -v node)"

if [ ! -f .env ]; then
  echo "Missing $APP_DIR/.env - create it once on the server (see DEPLOY-WEBUZO.md)." >&2
  exit 1
fi

mkdir -p uploads backups

echo "Installing packages..."
npm ci --omit=dev --no-audit --no-fund

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting API..."
PM2="npx --yes pm2@6"
$PM2 startOrReload deploy/ecosystem.config.cjs --update-env
$PM2 save

# Bring the API back after a server reboot (added once).
CRON_LINE="@reboot cd $APP_DIR && PATH=$(dirname "$(command -v node)"):\$PATH $PM2 resurrect"
if ! crontab -l 2>/dev/null | grep -qF "pm2@6 resurrect"; then
  { crontab -l 2>/dev/null || true; echo "$CRON_LINE"; } | crontab -
fi

PORT="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2 | tr -d '[:space:]"' || true)"
PORT="${PORT:-4000}"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "API is up on port $PORT."
    exit 0
  fi
  sleep 3
done
echo "API did not answer on port $PORT. Recent logs:" >&2
$PM2 logs fg-backend --lines 50 --nostream >&2 || true
exit 1
