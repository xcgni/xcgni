#!/bin/sh
# Pull-based deploy: compare the remote image digest with the running one; on change,
# recreate the app and prune. Outbound-only; never touches .env; refuses on bad config.
# Requires: docker login ghcr.io done once (or the package set public - preferred).
set -eu
APP_DIR="${APP_DIR:-/root/app}"
IMAGE_BASE="ghcr.io/xcgni/xcgni"
LOG="${LOG:-/var/log/xcgni-deploy.log}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

cd "$APP_DIR"
$COMPOSE config -q || { echo "$(date -Is) refuse: compose config invalid" >> "$LOG"; exit 1; }

TAG="${IMAGE_TAG:-latest}"
[ -f .env ] && TAG="$(grep -E '^IMAGE_TAG=' .env | cut -d= -f2 || true)"; TAG="${TAG:-latest}"
[ -f .env ] && CF_ZONE_ID="${CF_ZONE_ID:-$(grep -E '^CF_ZONE_ID=' .env | cut -d= -f2 || true)}"
[ -f .env ] && CF_API_TOKEN="${CF_API_TOKEN:-$(grep -E '^CF_API_TOKEN=' .env | cut -d= -f2 || true)}"
IMAGE="$IMAGE_BASE:$TAG"

OLD="$(docker image inspect "$IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null || echo none)"
docker pull -q "$IMAGE" >/dev/null
NEW="$(docker image inspect "$IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null || echo none)"

if [ "$OLD" != "$NEW" ]; then
  $COMPOSE up -d app

  # ── post-deploy verification: availability, provenance, and route freshness ──
  ok=0
  for i in $(seq 1 30); do
    curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1 && { ok=1; break; }
    sleep 2
  done
  [ "$ok" = "1" ] || { echo "$(date -Is) FAIL: app never became healthy after $IMAGE" >> "$LOG"; exit 1; }

  VER=$(curl -fsS http://127.0.0.1:3000/api/health | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
  if [ "$TAG" != "latest" ] && [ "v$VER" != "$TAG" ]; then
    echo "$(date -Is) FAIL: health reports v$VER but tag is $TAG" >> "$LOG"; exit 1
  fi

  # Optional Cloudflare purge (set CF_ZONE_ID and CF_API_TOKEN in .env to enable)
  if [ -n "${CF_ZONE_ID:-}" ] && [ -n "${CF_API_TOKEN:-}" ]; then
    curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
      -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
      --data '{"purge_everything":true}' >/dev/null 2>&1 \
      && echo "$(date -Is) cloudflare cache purged" >> "$LOG" \
      || echo "$(date -Is) WARN: cloudflare purge failed" >> "$LOG"
  fi

  # Every public route must serve the SAME version (kills the stale-edge ghost class)
  BAD=""
  for route in / /about /privacy /methodology /statistics /support; do
    body=$(curl -fsS "http://127.0.0.1:3000$route" 2>/dev/null || true)
    echo "$body" | grep -q "v$VER" || BAD="$BAD $route"
  done
  if [ -n "$BAD" ]; then
    echo "$(date -Is) FAIL: routes not on v$VER:$BAD (origin-side; if only the edge is stale, purge)" >> "$LOG"; exit 1
  fi

  docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
  echo "$(date -Is) deployed $IMAGE ($NEW, was $OLD) - health, provenance and all routes verified on v$VER" >> "$LOG"
else
  echo "$(date -Is) up-to-date $IMAGE ($NEW)" >> "$LOG"
fi
