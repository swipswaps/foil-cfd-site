#!/usr/bin/env bash
set -u

REPO_OWNER="${1:-$(gh api user --jq .login 2>/dev/null || true)}"
REPO_NAME="${2:-foil-cfd-site}"
FULL_REPO="${REPO_OWNER}/${REPO_NAME}"
PAGES_URL="https://${REPO_OWNER}.github.io/${REPO_NAME}/"

if [ -z "$REPO_OWNER" ]; then
  echo "[ERROR] Could not determine GitHub user. Pass owner as \$1." >&2
  exit 1
fi

echo "[INFO] Checking gh auth..."
gh auth status || { echo "[ERROR] gh not authenticated. Run: gh auth login"; exit 1; }

if gh repo view "$FULL_REPO" >/dev/null 2>&1; then
  echo "[OK] Repository $FULL_REPO exists."
else
  echo "[INFO] Creating repository $FULL_REPO..."
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
fi

echo "[INFO] Enabling GitHub Pages (build_type=workflow)..."
PAGES_RESPONSE=$(gh api "repos/${FULL_REPO}/pages" -X POST -f build_type="workflow" 2>&1) || true
if echo "$PAGES_RESPONSE" | grep -qi "409\|already enabled"; then
  echo "[OK] Pages already enabled."
elif echo "$PAGES_RESPONSE" | grep -qi "403\|Must have admin"; then
  echo "[WARN] Token lacks admin rights. Enable Pages manually:"
  echo "      https://github.com/${FULL_REPO}/settings/pages"
  echo "      Source → GitHub Actions → Save"
fi

echo "[INFO] Pushing to origin/main..."
git push origin main 2>/dev/null || git push -u origin main

echo "[INFO] Waiting for deploy run..."
sleep 5
RUN_ID=$(gh run list --workflow=deploy.yml --limit=1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "[WARN] No run found yet. Check: https://github.com/${FULL_REPO}/actions"
else
  echo "[INFO] Watching run $RUN_ID..."
  gh run watch "$RUN_ID" --exit-status --interval 10 || \
    echo "[WARN] Workflow did not complete successfully. Check Actions tab."
fi

echo "[INFO] Polling ${PAGES_URL} for HTTP 200..."
ATTEMPTS=0
MAX_ATTEMPTS=12
while [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL" || echo "000")
  echo "  Attempt $((ATTEMPTS+1))/$MAX_ATTEMPTS: HTTP $HTTP_STATUS"
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "[OK] GitHub Pages is live!"
    xdg-open "$PAGES_URL" >/dev/null 2>&1 || true
    exit 0
  fi
  ATTEMPTS=$((ATTEMPTS+1))
  sleep 10
done

echo "[INFO] Timed out waiting for 200. Site may still be propagating."
echo "       Check: $PAGES_URL"
echo "       Workflow: https://github.com/${FULL_REPO}/actions"
