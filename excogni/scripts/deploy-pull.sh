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
IMAGE="$IMAGE_BASE:$TAG"

OLD="$(docker image inspect "$IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null || echo none)"
docker pull -q "$IMAGE" >/dev/null
NEW="$(docker image inspect "$IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null || echo none)"

if [ "$OLD" != "$NEW" ]; then
  $COMPOSE up -d app
  docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
  echo "$(date -Is) deployed $IMAGE ($NEW, was $OLD)" >> "$LOG"
else
  echo "$(date -Is) up-to-date $IMAGE ($NEW)" >> "$LOG"
fi
