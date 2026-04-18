# Sprint 1 — 本地启动与验证（一页纸）

**目标**：在 30 分钟内完成依赖安装 → 数据库 → 网关与业务服务 → 管理端/运营端主路径。

## 1. 前置

- Node.js ≥ 18，pnpm ≥ 8
- Docker：启动 **PostgreSQL** + Redis 7（见 `code/docker-compose.yml` 或 `AGENTS.md`）
- 数据库：`scrm_dev`，初始化见 `code/scripts/init-db.pg.sql`；账号以 `docs/guides/环境配置说明.md` 为准

## 2. 安装与类型检查（`code/` 目录）

```bash
pnpm install
pnpm type-check
```

## 3. 启动后端（多终端或脚本）

| 服务 | 端口 | 说明 |
|------|------|------|
| gateway-service | 7000 | 必须先于前端联调 |
| auth-service | 7001 | 登录 |
| customer-service | 7002 | 运营客户列表 |
| operation-service | 7004 | SOP / 群发 |

示例（开发模式，在各服务目录）：

```bash
cd services/gateway-service && NODE_ENV=development npx mw dev
cd services/auth-service && NODE_ENV=development npx mw dev
# …按需启动 customer、operation
```

验证网关：

```bash
curl -s http://localhost:7000/health
```

验证登录（经网关）：

```bash
curl -s -X POST http://localhost:7000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

期望：HTTP 200，JSON 含 `accessToken`、`refreshToken`。

## 4. 启动前端

**管理平台**（端口 3001，`/api` → 7000）：

```bash
cd apps/admin-platform && pnpm dev
```

浏览器：`http://localhost:3001` → 登录 → 仪表盘 → 用户管理 → 服务监控。

**运营平台**（端口 3003）：

```bash
cd apps/operation-platform && pnpm dev
```

浏览器：`http://localhost:3003` → 登录 → 数据看板 → 客户列表 / SOP / 群发任务。

## 5. 自动化验收

**单元测试**（不依赖服务）：

```bash
pnpm test:unit
```

**E2E**（需网关 + 依赖服务 + 两个前端已启动，或仅跑 API 子集）：

```bash
cd e2e && pnpm install:browsers   # 首次
cd .. && pnpm test:e2e
```

若网关未启动，Playwright 用例会 **skip**（退出码 0），不视为失败；完整验收请在服务就绪后重跑。

## 6. 完成判定（Sprint 1）

- [ ] `pnpm test:unit` 通过  
- [ ] `curl` 登录经网关成功  
- [ ] 管理端、运营端主路径浏览器可走通  
- [ ] （可选）`pnpm test:e2e` 在服务与前端全开时全部通过且不 skip  
