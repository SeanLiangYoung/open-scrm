# 本地启动与验证 — Sprint 9（SEA 策略 + 扫码归因 + 漏斗 OLTP + COD mock）

与 [2026-04-28-sea-growth-attribution-implementation-plan.md](../plans/2026-04-28-sea-growth-attribution-implementation-plan.md) 对齐。

## 依赖服务

| 组件 | 说明 |
|------|------|
| PostgreSQL | `init-db.pg.sql` 含 `channel_scan_touch` 表（新库或迁移后） |
| Redis | 营销日频控计数、`acq:chscan:*` 幂等 |
| gateway + auth | 登录与路由 |
| message-service | `regionPackId=test-e2e-policy` 频控 |
| acquisition-service | 活码、`ingest-scan`、`scan-touches/latest` |
| integration-service | `POST /api/v1/integration/test/acquisition-channel-scan` |
| analytics-service | `GET /api/v1/analytics/funnel-gap-placeholder`（OLTP 聚合） |
| operation-service | （可选）`GET|POST /api/v1/operation/cod-mock/state` |

## 启动顺序（示例）

在 `code/` 下按需启动各 `mw dev`（端口见 [gateway-routes.md](../facts/gateway-routes.md)）；Docker 场景下网关常为 **`http://127.0.0.1:17000`**。

## E2E

```bash
cd code
export GATEWAY_URL=http://127.0.0.1:17000   # 按实际调整
pnpm test:e2e:sprint9
```

脚本：`e2e/run-sprint9-api.sh`（先 `curl` `/health`，再跑 `sprint9-sea-policy`、`sprint9-acquisition`、`sprint9-funnel-gap`、`sprint9-cod-mock`）。

## 手工抽查

- 频控：`sprint9-sea-policy.spec.ts` 说明（第 4 次营销发送应 `429` + `frequency_cap`）。
- 归因：`GET /api/v1/acquisition/channel-codes/:id/scan-touches/latest` 在带 UTM 的 ingest 后应有 `utmCampaign` 等字段。
- 漏斗 OLTP：`GET /api/v1/analytics/funnel-gap-placeholder` 返回 `source: 'oltp'` 与 `window`；指标由 `message_log` / `customer` / `channel_scan_touch` 聚合（见 [funnel-metrics-v0.1.md](../facts/funnel-metrics-v0.1.md)）。
- COD mock（可选）：`GET /POST /api/v1/operation/cod-mock/state`（需起 **operation-service**）。

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | 初稿 |
