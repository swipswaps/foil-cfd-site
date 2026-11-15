#!/usr/bin/env bash
set -u

REPO_OWNER="${1:-$(gh api user --jq .login 2>/dev/null || true)}"
REPO_NAME="${2:-foil-cfd-site}"
FULL_REPO="${REPO_OWNER}/${REPO_NAME}"
PAGES_URL="https://${REPO_OWNER}.github.io/${REPO_NAME}/"

[ -z "$REPO_OWNER" ] && { echo "[ERROR] Cannot determine repo owner. Run: gh auth login" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "[ERROR] gh not authenticated. Run: gh auth login" >&2; exit 1; }

if gh repo view "$FULL_REPO" >/dev/null 2>&1; then
  echo "[OK] Repo exists: $FULL_REPO"
  EXPECTED="https://github.com/${FULL_REPO}.git"
  CURRENT=$(git remote get-url origin 2>/dev/null || echo "")
  if [ -z "$CURRENT" ]; then
    git remote add origin "$EXPECTED"
  elif [ "$CURRENT" != "$EXPECTED" ] && [ "$CURRENT" != "git@github.com:${FULL_REPO}.git" ]; then
    git remote set-url origin "$EXPECTED"
  fi
else
  echo "[INFO] Creating repo: $FULL_REPO"
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

echo "[INFO] Enabling Pages (build_type=workflow)..."
gh api "repos/${FULL_REPO}/pages" -X POST -f build_type="workflow" >/dev/null 2>&1 || \
  gh api "repos/${FULL_REPO}/pages" -X PUT -f build_type="workflow" >/dev/null 2>&1 || \
  echo "[WARN] Pages API call failed. Enable manually: https://github.com/${FULL_REPO}/settings/pages"

echo "[INFO] Pushing to origin/main..."
git push origin main 2>/dev/null || git push -u origin main

echo "[INFO] Waiting for deploy run..."
sleep 5
RUN_ID=$(gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || echo "")

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "[ERROR] No workflow run found. Check: https://github.com/${FULL_REPO}/actions" >&2
  exit 1
fi

echo "[INFO] Watching run $RUN_ID..."
if ! gh run watch "$RUN_ID" --exit-status --interval 10; then
  echo "[ERROR] Workflow failed. Check: https://github.com/${FULL_REPO}/actions" >&2
  exit 1
fi

echo "[INFO] Polling $PAGES_URL for HTTP 200..."
for i in $(seq 1 18); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL" || echo "000")
  echo "  Attempt $i/18: HTTP $STATUS"
  if [ "$STATUS" = "200" ]; then
    echo "[OK] Live: $PAGES_URL"
    xdg-open "$PAGES_URL" >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 10
done

echo "[ERROR] Timed out waiting for HTTP 200. Check: $PAGES_URL" >&2
exit 1
