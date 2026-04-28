#!/usr/bin/env bash
# Sprint 5 API E2E：获客经网关 + integration 测试入口回写（需 gateway + auth + acquisition + integration + Redis + PG）
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:17000}"
export GATEWAY_URL
export ENABLE_INTEGRATION_TEST_ROUTES="${ENABLE_INTEGRATION_TEST_ROUTES:-1}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf -m 8 "${GATEWAY_URL}/health" >/dev/null; then
  echo "❌ 无法在 ${GATEWAY_URL} 访问网关 /health。"
  exit 1
fi

echo "✅ 运行 Sprint 5 API E2E（GATEWAY_URL=${GATEWAY_URL}）…"
pnpm --filter @scrm/e2e exec playwright test --project=sprint5-acquisition
echo "✅ Sprint 5 API E2E 完成"
