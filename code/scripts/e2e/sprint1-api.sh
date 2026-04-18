#!/usr/bin/env bash
# Sprint 1 API 冒烟（需 gateway :7000、auth :7001 已启动）
set -euo pipefail
GATEWAY="${GATEWAY_URL:-http://localhost:7000}"

echo "GET $GATEWAY/health"
curl -sf "$GATEWAY/health" | head -c 400
echo ""
echo ""

echo "POST $GATEWAY/api/v1/auth/login"
curl -sf -X POST "$GATEWAY/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}' | head -c 600
echo ""
echo "OK"
