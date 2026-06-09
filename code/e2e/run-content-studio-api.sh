#!/usr/bin/env bash
# Content Studio API E2E：创作中心经网关闭环（需 gateway + auth + acquisition + content-generation + Redis + PG）
# 建议在 content-generation-service 启动时设置：
#   CONTENT_GENERATION_SYNC=true CONTENT_GENERATION_MOCK_LLM=true PLATFORM_PUBLISH_MODE=mock
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:17000}"
export GATEWAY_URL

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf -m 8 "${GATEWAY_URL}/health" >/dev/null; then
  echo "❌ 无法在 ${GATEWAY_URL} 访问网关 /health。"
  exit 1
fi

echo "✅ 运行 Content Studio API E2E（GATEWAY_URL=${GATEWAY_URL}）…"
echo "   提示：content-generation-service 需 CONTENT_GENERATION_MOCK_LLM=true"
echo "   建议同步模式：CONTENT_GENERATION_SYNC=true（跳过 Bull 轮询不确定性）"
pnpm --filter @scrm/e2e exec playwright test --project=content-studio
echo "✅ Content Studio API E2E 完成"
