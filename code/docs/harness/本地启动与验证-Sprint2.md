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

## 3.1 企微回调（S2 收尾）

经网关（与生产一致）：

- **GET** `…/api/v1/integration/wework/callback?msg_signature=…&timestamp=…&nonce=…&echostr=…`：URL 验证；成功时响应体为**解密后的明文**（`text/plain`）。
- **POST** `…/api/v1/integration/wework/callback?msg_signature=…&timestamp=…&nonce=…`，`Content-Type: text/xml`：XML 包含 `Encrypt` 密文；验签 + 解密成功后响应 **`success`**。签名参数来自 URL，不从回复 XML 模板取值。

2026-10-25：按企微团队公开参考实现修正 **32 字节协议填充**，增加独立固定密文向量（20 字节填充）及 POST query 参数测试。此项只验证协议兼容，尚无真实企微账号验证，也没有把明文事件分发到客户、渠道或 SOP；不能将回调 `success` 当成业务链路已跑通。

数据库需存在一条启用的 `wework_config`，且 **`callback_token`、`encoding_aes_key` 与 `corp_id`** 与加解密向量一致。新数据卷执行 `init-db.pg.sql` 时会插入 **Sprint 2 开发用种子行**（corp_id=`wx1234567890abcdef`）。若你使用**旧数据卷**且表为空，可手动执行：

```sql
INSERT INTO wework_config (corp_id, corp_secret, callback_token, encoding_aes_key, status)
VALUES (
  'wx1234567890abcdef',
  'local_dev_placeholder_not_for_production',
  'scrm_s2_callback_token',
  'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
  1
) ON CONFLICT (corp_id) DO NOTHING;
```

## 4. 自动化

```bash
pnpm test:unit
pnpm test:e2e:sprint2
```

`test:e2e:sprint2` 会检查 `GATEWAY_URL`（默认 `http://127.0.0.1:17000`）上网关 `/health` 可达，再跑 Playwright `sprint2-integration`。完整带前端的 E2E 见 [README.md](./README.md)。

## 5. 故障排查

- **Docker 更新代码后务必重建镜像**：`docker compose build integration-service && docker compose up -d integration-service`（否则仍为旧 `dist`，健康检查字段不一致）。
- **502 / 网关代理错误**：多为 integration 未监听（容器重启循环）；`docker logs scrm-integration-service` 查看是否仍有 `*.spec.ts` 被打进产物（应已排除）。
- **企微回调经网关返回 401**：网关 `AuthMiddleware` 须将 `/api/v1/integration/wework/callback` 列入白名单（企微请求无 Bearer Token）。
- **POST 回调返回「期望 text/xml 请求体」**：网关须配置 `bodyParser.extendTypes.text` 包含 `text/xml`，否则代理转发时 `ctx.request.body` 为空，见 `gateway-service/src/config/config.default.ts`。
