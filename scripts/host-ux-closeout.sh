#!/usr/bin/env bash
# host-ux-closeout.sh
#
# Run this ON ws24 (the host with Docker, Tailscale, and Playwright). It applies
# the one secure origin for the foil.cfd app + API, proves the live tailnet
# end-to-end (e2e) suite with no retries, and can then commit and push the
# user-experience (UX) pass.
#
# Dry-run is the default. Nothing is changed until you pass an action flag.
#
# Usage:
#   bash scripts/host-ux-closeout.sh            # print the plan and probes only
#   bash scripts/host-ux-closeout.sh --apply    # build, serve on 8443, prove e2e
#   bash scripts/host-ux-closeout.sh --commit   # lint, typecheck, offline e2e gate, commit
#   bash scripts/host-ux-closeout.sh --push     # push both repos via push-all.sh
#   bash scripts/host-ux-closeout.sh --all      # apply, commit (with gate), push
#   bash scripts/host-ux-closeout.sh --reset-serve   # allow `tailscale serve reset`
#
# It never touches the JEF Caddy listener on 443 and never enables Funnel.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
DIST="$REPO/dist"
APP_HOST="127.0.0.1"
APP_PORT="4174"
API_URL="http://127.0.0.1:8002"
HTTPS_PORT="8443"
SKILL="$HOME/.config/opencode/skills/agent-host-ops"
PROXY="$SKILL/serve-same-origin.py"
PUSH_ALL="$SKILL/push-all.sh"
PROXY_PID="/tmp/foil-app.pid"
PROXY_LOG="/tmp/foil-app.log"
PROXY_ERR="/tmp/foil-app.err"

APPLY=0
COMMIT=0
PUSH=0
RESET_SERVE=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) : ;;
    --apply) APPLY=1 ;;
    --commit) COMMIT=1 ;;
    --push) PUSH=1 ;;
    --all) APPLY=1; COMMIT=1; PUSH=1 ;;
    --reset-serve) RESET_SERVE=1 ;;
    -h|--help)
      awk '/^#( |$)/ { sub(/^# ?/, ""); print }' "$0"
      exit 0
      ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

say() { printf '%s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing tool: %s\n' "$1" >&2
    return 1
  fi
}

resolve_tsn() {
  tailscale status --json | python3 -c 'import sys,json; print((json.load(sys.stdin).get("Self") or {}).get("DNSName","").rstrip("."))'
}

probe() {
  say "repo:   $REPO"
  say "dist:   $DIST"
  say "app:    http://$APP_HOST:$APP_PORT/  (proxy)"
  say "api:    $API_URL"
  say "serve:  https://${TSN:-<unresolved>}:$HTTPS_PORT/"
  say "proxy script: $PROXY"
  say ""
  say "--- git state ---"
  git -C "$REPO" status -sb
  say ""
  say "--- dist base (must be /assets for the same-origin app) ---"
  if [ -f "$DIST/index.html" ]; then
    grep -o '"/[^"]*assets/[^"]*"' "$DIST/index.html" | head -n 3 || true
  else
    say "no dist yet"
  fi
  say ""
  say "--- tailscale serve ---"
  if command -v tailscale >/dev/null 2>&1; then
    tailscale serve status || true
    say "--- tailscale funnel (must be empty) ---"
    tailscale funnel status || true
  else
    say "tailscale not installed here (run on ws24)"
  fi
}

build_same_origin() {
  say "== build: npx vite build --base=/ =="
  ( cd "$REPO" && env -u VITE_BACKEND_URL npx vite build --base=/ )
  if grep -q '/foil-cfd-site/assets' "$DIST/index.html"; then
    fail "dist still uses the GitHub Pages base; the same-origin app would 404"
  fi
  say "dist index base OK"
}

ensure_proxy() {
  if curl -fsS -o /dev/null "http://$APP_HOST:$APP_PORT/"; then
    say "== proxy already answering on $APP_HOST:$APP_PORT =="
    return 0
  fi
  say "== start same-origin proxy on $APP_HOST:$APP_PORT =="
  nohup python3 "$PROXY" \
    --dist "$DIST" \
    --listen "$APP_HOST:$APP_PORT" \
    --api "$API_URL" \
    >"$PROXY_LOG" 2>"$PROXY_ERR" &
  echo $! >"$PROXY_PID"
  local i
  for i in $(seq 1 20); do
    if curl -fsS -o /dev/null "http://$APP_HOST:$APP_PORT/"; then
      say "proxy ready (pid $(cat "$PROXY_PID"))"
      return 0
    fi
    sleep 1
  done
  say "--- $PROXY_ERR ---"
  tail -n 20 "$PROXY_ERR" || true
  fail "proxy did not answer on $APP_HOST:$APP_PORT"
}

serve_apply() {
  say "== tailscale serve: one HTTPS origin for app + API =="
  if ! tailscale serve --https="$HTTPS_PORT" off; then
    if [ "$RESET_SERVE" = 1 ]; then
      say "serve off refused; resetting the serve config as requested"
      tailscale serve reset
    else
      fail "tailscale serve off refused. Re-run with --reset-serve only if 8443 holds no mapping you need."
    fi
  fi
  tailscale serve --bg --https="$HTTPS_PORT" --set-path=/ "http://$APP_HOST:$APP_PORT"
  say "--- serve status ---"
  tailscale serve status
  say "--- funnel status (must be empty) ---"
  tailscale funnel status
}

accept_origin() {
  local app_code api_code
  app_code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "https://$TSN:$HTTPS_PORT/" || true)"
  api_code="$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "https://$TSN:$HTTPS_PORT/api/health" || true)"
  say "https app=$app_code api=$api_code"
  if [ "$app_code" != "200" ] || [ "$api_code" != "200" ]; then
    say "WARN: the host may hairpin on its own Tailscale name. Confirm from a tailnet client;"
    say "      the browser e2e below is the authoritative proof."
  fi
}

run_e2e() {
  say "== live tailnet e2e (--retries=0) =="
  local out rc
  set +e
  out="$(cd "$REPO" && TAILNET_APP_URL="https://$TSN:$HTTPS_PORT/" \
    npx playwright test tests/e2e/tailnet.spec.ts --project=desktop-chrome --retries=0 2>&1)"
  rc=$?
  set -e
  printf '%s\n' "$out" | tail -n 25
  if [ "$rc" -ne 0 ]; then
    fail "tailnet e2e exited $rc"
  fi
  if ! printf '%s\n' "$out" | grep -Eq '2 passed'; then
    fail "tailnet e2e did not report 2 passed"
  fi
  if printf '%s\n' "$out" | grep -Eq '[1-9][0-9]* (skipped|flaky)'; then
    fail "tailnet e2e reported a skip or a flake; treat as failure"
  fi
  say "PASS: tailnet e2e 2 passed, 0 skipped, 0 flaky"
}

run_offline_e2e() {
  say "== offline/static e2e (CI gate, --retries=0) =="
  local port="4185" pid rc i
  local out="/tmp/foil-offline-dist-$port"
  local log="/tmp/foil-offline-e2e.log" err="/tmp/foil-offline-e2e.err"
  pushd "$REPO" >/dev/null
  # Build into a throwaway directory so the live same-origin dist is never
  # replaced while the gate runs. Pin the offline build's backend URL to the
  # preview origin so the probe never reaches a real backend that happens to be
  # listening on this host (ws24 has services on 127.0.0.1:8000/8002).
  VITE_BACKEND_URL="http://127.0.0.1:$port" \
    npx vite build --outDir "$out" --emptyOutDir >/dev/null
  nohup npx vite preview --outDir "$out" --port "$port" --strictPort --host 127.0.0.1 >"$log" 2>"$err" &
  pid=$!
  for i in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:$port/foil-cfd-site/"; then
      break
    fi
    sleep 1
  done
  if ! curl -fsS -o /dev/null "http://127.0.0.1:$port/foil-cfd-site/"; then
    tail -n 20 "$err" || true
    kill -TERM "$pid" 2>/dev/null || true
    rm -rf "$out"
    popd >/dev/null
    fail "offline preview did not start on port $port"
  fi
  set +e
  PLAYWRIGHT_BASE_URL="http://127.0.0.1:$port/foil-cfd-site" \
    npx playwright test \
      tests/e2e/foil-static.spec.ts \
      tests/e2e/foil-offline.spec.ts \
      tests/e2e/foil-components.spec.ts \
      tests/e2e/foil-ux.spec.ts \
      tests/e2e/foil-a11y.spec.ts \
      --project=desktop-chrome --retries=0 --workers=1
  rc=$?
  set -e
  kill -TERM "$pid" 2>/dev/null || true
  rm -rf "$out"
  popd >/dev/null
  if [ "$rc" -ne 0 ]; then
    fail "offline e2e exited $rc"
  fi
  say "PASS: offline/static e2e"
}

do_commit() {
  say "== gates before commit =="
  ( cd "$REPO" && npm run lint )
  ( cd "$REPO" && npm run typecheck )
  run_offline_e2e
  say "== stage UX changes =="
  git -C "$REPO" add -- \
    .github/workflows/deploy.yml \
    README.md \
    package.json \
    package-lock.json \
    src/App.tsx \
    src/components/BackendBadge.tsx \
    src/components/CfdVtkViewer.tsx \
    src/components/LabCoachMark.tsx \
    src/components/NavBar.tsx \
    src/components/Sidebar.tsx \
    src/components/SolverStatus.tsx \
    src/hooks/useBackendProbe.ts \
    src/index.css \
    src/lib/cp.ts \
    src/lib/fields.ts \
    src/lib/probe.ts \
    src/lib/solverStatus.ts \
    src/sections/CfdLab.tsx \
    src/sections/Hero.tsx \
    src/sections/HydroLab.tsx \
    tests/e2e/advanced.spec.ts \
    tests/e2e/foil-a11y.spec.ts \
    tests/e2e/foil-advanced.spec.ts \
    tests/e2e/foil-components.spec.ts \
    tests/e2e/foil-offline.spec.ts \
    tests/e2e/foil-static.spec.ts \
    tests/e2e/foil-ux.spec.ts \
    tests/e2e/tailnet.spec.ts \
    scripts/host-ux-closeout.sh
  if git -C "$REPO" diff --cached --quiet; then
    say "nothing staged; already committed"
    return 0
  fi
  git -C "$REPO" commit -m "a11y: axe gate for overview+lab; fix hero label-in-name and persistent h1"
  say "revert with: git -C \"$REPO\" revert $(git -C "$REPO" rev-parse HEAD)"
}

do_push() {
  say "== push both repos =="
  if [ ! -f "$PUSH_ALL" ]; then
    fail "missing $PUSH_ALL"
  fi
  bash "$PUSH_ALL"
}

if [ "$APPLY" = 0 ] && [ "$COMMIT" = 0 ] && [ "$PUSH" = 0 ]; then
  say "DRY RUN — no changes. Capability probe:"
  missing=0
  for t in tailscale curl npx git python3; do need "$t" || missing=1; done
  [ -f "$PROXY" ] || { say "missing proxy: $PROXY"; missing=1; }
  TSN="$(resolve_tsn 2>/dev/null || true)"
  probe
  say ""
  if [ "$missing" -ne 0 ]; then
    say "Host tools are incomplete here; run this on ws24."
    exit 3
  fi
  say "Plan: --apply (build + serve + e2e), then --commit, then --push."
  exit 0
fi

# Actions that need the host stack.
for t in tailscale curl npx git python3; do
  need "$t" || fail "missing host tool: $t"
done
[ -f "$PROXY" ] || fail "missing proxy script: $PROXY"
TSN="$(resolve_tsn)"
[ -n "$TSN" ] || fail "could not resolve the Tailscale DNS name"
say "Tailscale DNS name: $TSN"

if [ "$APPLY" = 1 ]; then
  build_same_origin
  ensure_proxy
  serve_apply
  accept_origin
  run_e2e
fi

if [ "$COMMIT" = 1 ]; then
  do_commit
fi

if [ "$PUSH" = 1 ]; then
  do_push
fi

say "done"
