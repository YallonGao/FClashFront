#!/usr/bin/env bash
# Start the FClashFront dev server. /api is proxied to 127.0.0.1:8780.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-5180}"

if [ ! -d node_modules ]; then
  echo "installing dependencies"
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
fi

echo
echo "  Console  http://localhost:${PORT}"
echo "  API      proxied to http://127.0.0.1:8780 (start FClashBack first)"
echo

exec npm run dev -- --port "$PORT"
