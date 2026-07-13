#!/bin/sh
set -e
echo "[excogni] running migrations..."
node scripts/migrate.mjs
echo "[excogni] seeding..."
node scripts/seed.mjs
echo "[excogni] starting app..."
exec node build/index.js
