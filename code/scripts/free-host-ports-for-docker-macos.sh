#!/usr/bin/env bash
# 释放本机 5432（PostgreSQL）与 7000（常见为 AirPlay 接收器），便于 Docker Compose 使用默认映射。
# 用法：在终端执行  bash scripts/free-host-ports-for-docker-macos.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 当前监听 5432 / 7000 的进程 =="
/usr/sbin/lsof -nP -iTCP:5432 -sTCP:LISTEN 2>/dev/null || true
/usr/sbin/lsof -nP -iTCP:7000 -sTCP:LISTEN 2>/dev/null || true
echo ""

PG_CTL="/Library/PostgreSQL/18/bin/pg_ctl"
PG_DATA="/Library/PostgreSQL/18/data"
if [[ -x "$PG_CTL" && -d "$PG_DATA" ]]; then
  echo "尝试停止本机 PostgreSQL 18（EnterpriseDB 路径，需要输入本机密码）："
  sudo "$PG_CTL" stop -D "$PG_DATA" -m fast
  echo "PostgreSQL 已请求停止。"
else
  echo "未找到 $PG_CTL 或数据目录 $PG_DATA；若本机用 Homebrew Postgres，请改用："
  echo "  brew services stop postgresql@14   # 版本号按实际调整"
fi

echo ""
echo "7000 端口：在较新的 macOS 上常由「隔空播放接收器」(ControlCenter) 占用。"
echo "请关闭：系统设置 → 通用 → 隔空播放与接力 → 隔空播放接收器 → 关"
echo "然后可执行：/usr/sbin/lsof -nP -iTCP:7000 -sTCP:LISTEN"
echo ""
echo "释放完成后，在 code/ 目录执行：docker compose up -d"
