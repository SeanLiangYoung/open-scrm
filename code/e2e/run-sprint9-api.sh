#!/usr/bin/env bash
# Sprint 9 API E2E：RegionPack 营销频控 + 扫码归因 ingest（需 gateway + auth + message + redis + acquisition + integration 测试路由）
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:17000}"
export GATEWAY_URL

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf -m 8 "${GATEWAY_URL}/health" >/dev/null; then
  echo "❌ 无法在 ${GATEWAY_URL} 访问网关 /health。"
  exit 1
fi

echo "✅ 运行 Sprint 9 API E2E（GATEWAY_URL=${GATEWAY_URL}）…"
pnpm --filter @scrm/e2e exec playwright test --project=sprint9-sea-policy --project=sprint9-acquisition --project=sprint9-funnel-gap
echo "✅ Sprint 9 API E2E 完成"
