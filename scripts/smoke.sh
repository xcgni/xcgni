#!/usr/bin/env bash
# Smoke test for a deployed instance - the checks that must pass before the HN post.
#   ./scripts/smoke.sh https://xcgni.com
# Exits non-zero on the first failure. Read-only: creates no accounts, sends no email.
set -u
BASE="${1:?usage: smoke.sh https://host}"
FAIL=0

check() { # label, expected_status, path [, must_contain]
  local label="$1" want="$2" path="$3" must="${4:-}"
  local tmp; tmp=$(mktemp)
  local got; got=$(curl -sS -o "$tmp" -w '%{http_code}' --max-time 15 "$BASE$path")
  if [ "$got" != "$want" ]; then
    echo "FAIL $label: $path -> $got (wanted $want)"; FAIL=1
  elif [ -n "$must" ] && ! grep -qi "$must" "$tmp"; then
    echo "FAIL $label: $path missing expected content '$must'"; FAIL=1
  else
    echo "ok   $label"
  fi
  rm -f "$tmp"
}

check "healthz is up"                200 "/healthz" '"status":"ok"'
check "landing renders"              200 "/" "Excogni"
check "statistics renders"           200 "/statistics" ""
check "privacy email section"        200 "/privacy" ""
check "about renders"                200 "/about" "faculties"
check "a faculty explainer renders"  200 "/about/working_memory" ""
check "methodology renders"          200 "/methodology" "since v"
check "changelog renders"            200 "/changelog" "including the mistakes"
check "robots.txt"                   200 "/robots.txt" ""
check "sitemap lists faculty pages"  200 "/sitemap.xml" "/about/"
# enabled deployments redirect to login (303); ADMIN_TOKEN-less deployments 404 instead
ADMIN_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/admin")
case "$ADMIN_STATUS" in
  303|404) echo "ok   admin without auth is gated ($ADMIN_STATUS)" ;;
  *) echo "FAIL admin without auth: /admin -> $ADMIN_STATUS (wanted 303 or 404)"; FAIL=1 ;;
esac
check "admin login page exists"      200 "/admin/login" ""
check "export requires a session"    401 "/api/export" ""
check "unknown page 404s"            404 "/definitely-not-a-page" ""

# healthz must not be cacheable (a CDN-cached 200 masks outages)
CC=$(curl -sSI --max-time 15 "$BASE/healthz" | tr -d '\r' | grep -i '^cache-control:' || true)
case "$CC" in
  *no-store*) echo "ok   healthz is no-store" ;;
  *) echo "FAIL healthz Cache-Control is '$CC' (want no-store)"; FAIL=1 ;;
esac

if [ "$FAIL" -eq 0 ]; then echo; echo "SMOKE TEST PASSED - $BASE"; else echo; echo "SMOKE TEST FAILED"; exit 1; fi
