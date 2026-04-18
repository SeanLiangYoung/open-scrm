#!/usr/bin/env bash
# 在 macOS / Linux 上一键拉起基础设施并启动全部后端微服务。
# 用法：在 code/ 目录执行：bash scripts/run/start-dev-macos.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 docker 命令。请先安装并启动 Docker Desktop（或确保 docker 在 PATH 中）。"
  exit 1
fi

echo ">>> 启动 Docker 服务（PostgreSQL、Redis、MongoDB、RabbitMQ）..."
docker compose up -d postgres redis mongodb rabbitmq

echo ">>> 等待 PostgreSQL 就绪（最多 60s）..."
ok=0
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U postgres -d scrm_dev 2>/dev/null; then
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" != "1" ]]; then
  echo "PostgreSQL 未在预期时间内就绪，请检查: docker compose logs postgres"
  exit 1
fi

echo ">>> 启动全部后端服务（pnpm dev:service）..."
exec pnpm dev:service
