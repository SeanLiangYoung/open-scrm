#!/usr/bin/env bash
# Sprint 3 API E2E：经网关消息发送幂等 + 日志查询（需 gateway + auth + message + DB）
# 用法（在 code/ 目录）：pnpm test:e2e:sprint3
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:17000}"
export GATEWAY_URL

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf -m 8 "${GATEWAY_URL}/health" >/dev/null; then
  echo "❌ 无法在 ${GATEWAY_URL} 访问网关 /health。"
  echo "   请先启动后端，或设置 GATEWAY_URL=http://127.0.0.1:7000"
  exit 1
fi

echo "✅ 运行 Sprint 3 API E2E（GATEWAY_URL=${GATEWAY_URL}）…"
pnpm --filter @scrm/e2e exec playwright test --project=sprint3-messages
echo "✅ Sprint 3 API E2E 完成"
