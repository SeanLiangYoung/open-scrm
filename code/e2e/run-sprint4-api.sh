#!/usr/bin/env bash
# Sprint 4 API E2E：经网关 analytics 日聚合 + overview/summary（需 gateway + auth + analytics + PG）
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:17000}"
export GATEWAY_URL

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf -m 8 "${GATEWAY_URL}/health" >/dev/null; then
  echo "❌ 无法在 ${GATEWAY_URL} 访问网关 /health。"
  exit 1
fi

echo "✅ 运行 Sprint 4 API E2E（GATEWAY_URL=${GATEWAY_URL}）…"
pnpm --filter @scrm/e2e exec playwright test --project=sprint4-analytics
echo "✅ Sprint 4 API E2E 完成"
