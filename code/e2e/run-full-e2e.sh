#!/usr/bin/env bash
# 完整 E2E：启动两个 Vite 前端 → wait-on → Playwright（API + 浏览器）
# 用法（在 code/ 目录）：pnpm test:e2e
# 环境变量：
#   GATEWAY_URL   默认 http://127.0.0.1:17000（Docker 网关映射）
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:17000}"
export VITE_GATEWAY_URL="$GATEWAY_URL"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! curl -sf -m 5 "${GATEWAY_URL}/health" >/dev/null; then
  echo "❌ 无法在 ${GATEWAY_URL} 访问网关 /health，请先启动后端（Docker 等）。"
  exit 1
fi

echo "✅ 网关可达，启动 admin-platform :3001 与 operation-platform :3003 …"

for port in 3001 3003; do
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "⚠️  释放占用端口 $port 的进程 …"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
done

pnpm --filter @scrm/admin-platform dev &
PID1=$!
pnpm --filter @scrm/operation-platform dev &
PID2=$!

cleanup() {
  kill "$PID1" "$PID2" 2>/dev/null || true
  wait "$PID1" 2>/dev/null || true
  wait "$PID2" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 使用 localhost（与 Vite 默认 “Local: http://localhost:…” 一致；127.0.0.1 在部分环境会 ECONNREFUSED）
pnpm --filter @scrm/e2e exec wait-on -t 300000 -v \
  "http://127.0.0.1:3001" \
  "http://127.0.0.1:3003"

echo "✅ 前端已响应，安装/校验 Playwright 浏览器（首次会下载 Chromium）…"
pnpm --filter @scrm/e2e exec playwright install chromium

echo "✅ 运行 Playwright（API + 浏览器）…"

export GATEWAY_URL
pnpm --filter @scrm/e2e exec playwright test

echo "✅ E2E 全部执行完毕"
