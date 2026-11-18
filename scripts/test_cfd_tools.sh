#!/usr/bin/env bash
# Exercises every CFD backend tool.
BASE="${1:-http://127.0.0.1:8002}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local ok="$2"
  local detail="$3"
  if [ "$ok" = "1" ]; then
    echo "  [PASS] $name"
    PASS=$((PASS+1))
  else
    echo "  [FAIL] $name ${detail:+— $detail}"
    FAIL=$((FAIL+1))
  fi
}

echo "============================================"
echo " FOIL.CFD tool test — $BASE"
echo "============================================"
echo ""

echo "[1] Health"
H_CODE=$(curl -s -m 5 -o /tmp/foil-health.json -w "%{http_code}" "$BASE/api/health")
[ -n "$H_CODE" ] || H_CODE=000
if [ "$H_CODE" = "200" ]; then
  check "GET /api/health → 200" 1
  H_ST=$(python3 -c "import json;print(json.load(open('/tmp/foil-health.json')).get('status',''))" 2>/dev/null || echo "")
  check "  status == 'online'" "$([ "$H_ST" = "online" ] && echo 1 || echo 0)" "got '$H_ST'"
  H_SOLVER=$(python3 -c "import json;print(json.load(open('/tmp/foil-health.json')).get('solver_available',False))" 2>/dev/null || echo "False")
  echo "  [INFO] solver_available = $H_SOLVER"
else
  check "GET /api/health → 200" 0 "HTTP $H_CODE (is docker compose up?)"
  echo ""
  echo "Cannot continue without backend. Start: docker compose up --build -d"
  exit 1
fi
echo ""

echo "[2] Default VTP dataset"
V_CODE=$(curl -s -m 30 -o /tmp/foil-default.vtp -w "%{http_code}" "$BASE/api/jobs/default/surface.vtp")
[ -n "$V_CODE" ] || V_CODE=000
if [ "$V_CODE" = "000" ]; then
  sleep 3
  V_CODE=$(curl -s -m 30 -o /tmp/foil-default.vtp -w "%{http_code}" "$BASE/api/jobs/default/surface.vtp")
  [ -n "$V_CODE" ] || V_CODE=000
fi
if [ "$V_CODE" = "200" ]; then
  check "GET /api/jobs/default/surface.vtp → 200" 1
  V_SIZE=$(stat -c%s /tmp/foil-default.vtp 2>/dev/null || stat -f%z /tmp/foil-default.vtp 2>/dev/null || echo 0)
  check "  file > 100 bytes" "$([ "$V_SIZE" -gt 100 ] && echo 1 || echo 0)" "size=$V_SIZE"
  grep -q 'VTKFile' /tmp/foil-default.vtp && check "  VTK XML header" 1 || check "  VTK XML header" 0
else
  check "GET /api/jobs/default/surface.vtp → 200" 0 "HTTP $V_CODE"
fi
echo ""

echo "[3] POST /api/solve"
S_CODE=$(curl -s -m 15 -X POST -H "Content-Type: application/json" \
  -d '{"case_id":"naca0012"}' \
  -o /tmp/foil-solve.json -w "%{http_code}" "$BASE/api/solve")
[ -n "$S_CODE" ] || S_CODE=000
JOB_ID=""
if [ "$S_CODE" = "200" ]; then
  check "POST /api/solve → 200" 1
  JOB_ID=$(python3 -c "import json;print(json.load(open('/tmp/foil-solve.json')).get('job_id',''))" 2>/dev/null || echo "")
  check "  job_id in response" "$([ -n "$JOB_ID" ] && echo 1 || echo 0)"
else
  check "POST /api/solve → 200" 0 "HTTP $S_CODE"
fi
echo ""

if [ -n "$JOB_ID" ]; then
  echo "[4] Polling /api/jobs/$JOB_ID"
  sleep 2
  J_ST=""
  for i in $(seq 1 20); do
    curl -s -m 5 "$BASE/api/jobs/$JOB_ID" -o /tmp/foil-job.json
    J_ST=$(python3 -c "import json;print(json.load(open('/tmp/foil-job.json')).get('status',''))" 2>/dev/null || echo "")
    [ "$J_ST" = "completed" ] && break
    [ "$J_ST" = "failed" ] && break
    sleep 2
  done
  check "Job reaches terminal state" "$([ "$J_ST" = "completed" ] || [ "$J_ST" = "failed" ] && echo 1 || echo 0)" "final=$J_ST"
  check "  status == 'completed'" "$([ "$J_ST" = "completed" ] && echo 1 || echo 0)" "final=$J_ST"
  echo ""

  if [ "$J_ST" = "completed" ]; then
    echo "[5] Analysis /api/jobs/$JOB_ID/analysis"
    A_CODE=$(curl -s -m 30 -o /tmp/foil-analysis.json -w "%{http_code}" "$BASE/api/jobs/$JOB_ID/analysis")
    [ -n "$A_CODE" ] || A_CODE=000
    if [ "$A_CODE" = "200" ]; then
      check "GET /analysis → 200" 1
      N_PTS=$(python3 -c "import json;print(json.load(open('/tmp/foil-analysis.json')).get('n_points',0))" 2>/dev/null || echo 0)
      check "  n_points > 0" "$([ "$N_PTS" -gt 0 ] && echo 1 || echo 0)" "n_points=$N_PTS"
    else
      check "GET /analysis → 200" 0 "HTTP $A_CODE"
    fi
    echo ""

    echo "[6] Job surface /api/jobs/$JOB_ID/surface.vtp"
    JV_CODE=$(curl -s -m 30 -o /tmp/foil-job.vtp -w "%{http_code}" "$BASE/api/jobs/$JOB_ID/surface.vtp")
    [ -n "$JV_CODE" ] || JV_CODE=000
    if [ "$JV_CODE" = "200" ]; then
      check "GET /surface.vtp → 200" 1
      grep -q 'VTKFile' /tmp/foil-job.vtp && check "  VTK XML header" 1 || check "  VTK XML header" 0
    else
      check "GET /surface.vtp → 200" 0 "HTTP $JV_CODE"
    fi
    echo ""
  fi
fi

echo "[7] CORS preflight from GitHub Pages"
CORS_CODE=$(curl -s -m 5 -o /dev/null -X OPTIONS \
  -H "Origin: https://swipswaps.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -w "%{http_code}" "$BASE/api/solve")
[ -n "$CORS_CODE" ] || CORS_CODE=000
check "OPTIONS /api/solve → 200" "$([ "$CORS_CODE" = "200" ] && echo 1 || echo 0)" "HTTP $CORS_CODE"
echo ""

echo "[8] SketchForge-3D (port 8090, optional)"
SF_CODE=$(curl -s -m 3 -o /dev/null -w "%{http_code}" "http://127.0.0.1:8090")
[ -n "$SF_CODE" ] || SF_CODE=000
if [ "$SF_CODE" = "200" ] || [ "$SF_CODE" = "301" ] || [ "$SF_CODE" = "302" ]; then
  check "GET :8090 → 2xx/3xx" 1
else
  echo "  [SKIP] SketchForge-3D not running (optional)"
fi
echo ""

echo "============================================"
echo " RESULT: PASS=$PASS  FAIL=$FAIL"
echo "============================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
