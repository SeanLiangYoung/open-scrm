# Sprint 3 — 本地启动与验证（一页纸）

对应 [迭代计划-E2E.md](../迭代计划-E2E.md) §5 与 [Sprint3-功能开发测试计划.md](./Sprint3-功能开发测试计划.md)。

## 1. 依赖服务

| 组件 | 说明 |
|------|------|
| PostgreSQL | 库 `scrm_dev`；`message_log` 需列 `idempotency_key` 与唯一索引（新卷见 `code/scripts/init-db.pg.sql`） |
| Redis | message-service 配置默认与仓库一致 |
| gateway-service | 默认容器映射宿主机 **17000** → 7000；本地直连网关则用 `GATEWAY_URL` |
| auth-service | 登录拿 Bearer |
| message-service | 默认 **7008**（见根 `docs/开发计划.md` 端口表） |

## 2. 启动顺序（建议）

1. `docker compose up -d postgres redis`（在 `code/` 下，与 AGENTS.md 一致）
2. `auth-service`、`message-service`、`gateway-service` 均已构建并可连上述中间件
3. 登录账号：`admin` / `Admin@123`（种子数据）

## 3. 验收命令

在 **`code/`** 目录：

```bash
pnpm test:unit
pnpm test:e2e:sprint3
```

- 默认 `GATEWAY_URL=http://127.0.0.1:17000`；本机网关若跑在 7000：`GATEWAY_URL=http://127.0.0.1:7000 pnpm test:e2e:sprint3`
- 网关 `/health` 不可达时，Playwright 用例会 **skip**（与 Sprint 1/2 API 用例一致）

## 4. API 速查（经网关）

- **发送**：`POST /api/v1/messages/send`
  - Header：`Authorization: Bearer <accessToken>`，可选 `Idempotency-Key: <128 字符内>`
  - Body：`messageType`（E2E 用显式 `5` 为 Mock 模拟渠道，不会真实送达）、`targetType`、`targetIds`（**使用幂等键时仅 1 个**）、`content`
- **查状态**：`GET /api/v1/messages/logs/:id`（同上 Bearer；仅本企业日志）

## 5. 旧库缺列时

若 PostgreSQL 数据卷在加入 S3 脚本**之前**已创建，可能缺少 `idempotency_key`。可对 `message_log` 执行与 `init-db.pg.sql` 中一致的：

- `ALTER TABLE message_log ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);`
- `CREATE UNIQUE INDEX IF NOT EXISTS ux_message_log_corp_idempotency ON message_log (corp_id, idempotency_key) WHERE idempotency_key IS NOT NULL;`

然后重启 message-service 再跑 E2E。
