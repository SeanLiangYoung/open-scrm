# Sprint 2 — 本地启动与验证（企微集成）

**目标**：启动网关、integration-service、PostgreSQL、Redis 后，`GET /api/v1/integration/health` 经网关返回 `status: ok`，且 `database`、`redis` 均为 `connected`。

## 1. 前置

- 已完成 `code/` 下 `pnpm install`
- Docker 或本机：**PostgreSQL**（库 `scrm_dev`）、**Redis**（与 `config.default` 中 `db` 一致）
- 环境变量（可选）：`DB_HOST`、`DB_PORT`、`REDIS_HOST`、`REDIS_PORT`

## 2. 启动服务（示例）

| 服务 | 端口（默认） | 说明 |
|------|----------------|------|
| gateway-service | 7000 或 `GATEWAY_URL` 映射端口 | 对外 `/api` |
| integration-service | 7007 | 企微集成 |

```bash
cd services/gateway-service && NODE_ENV=development npx mw dev
cd services/integration-service && NODE_ENV=local npx mw dev
```

## 3. 验证

**直连 integration（可选）**

```bash
curl -s http://127.0.0.1:7007/api/v1/integration/health
```

**经网关（与 E2E 一致）**

```bash
curl -s http://127.0.0.1:7000/api/v1/integration/health
```

若使用 Docker 将网关映射到 **17000**，将上式中的主机端口改为 `17000`，或与 `GATEWAY_URL` 一致。

期望 JSON 包含：`"status":"ok"`、`"database":"connected"`、`"redis":"connected"`。

## 4. 自动化

```bash
pnpm test:unit
pnpm --filter @scrm/e2e exec playwright test --project=sprint2-integration
```

（完整 E2E 见 [README.md](./README.md)。）
