#!/usr/bin/env bash
# Sprint 2 API E2E：经网关探测 integration health（无需前端）
# 用法（在 code/ 目录）：pnpm test:e2e:sprint2
# 依赖：GATEWAY_URL 可达（默认 http://127.0.0.1:17000，与 Docker 网关映射一致）
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:17000}"
export GATEWAY_URL

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf -m 8 "${GATEWAY_URL}/health" >/dev/null; then
  echo "❌ 无法在 ${GATEWAY_URL} 访问网关 /health。"
  echo "   请先启动后端（例如：docker compose up -d gateway-service），或设置 GATEWAY_URL=http://127.0.0.1:7000"
  exit 1
fi

echo "✅ 运行 Sprint 2 API E2E（GATEWAY_URL=${GATEWAY_URL}）…"
pnpm --filter @scrm/e2e exec playwright test --project=sprint2-integration
echo "✅ Sprint 2 API E2E 完成"
