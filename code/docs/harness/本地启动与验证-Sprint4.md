# Sprint 4 — 本地启动与验证（一页纸）

对应 [迭代计划-E2E.md](../迭代计划-E2E.md) §6 与 [Sprint4-功能开发测试计划.md](./Sprint4-功能开发测试计划.md)。

## 1. 依赖

| 组件 | 说明 |
|------|------|
| PostgreSQL | `daily_stat` 表 + 唯一索引 `ux_daily_stat_corp_date` |
| gateway、auth、analytics | 默认 analytics **7006**，网关映射见根 `docs/开发计划.md` |

## 2. API 验收（`code/`）

```bash
pnpm test:e2e:sprint4
pnpm test:unit
```

手动示例（网关 `17000`、先登录拿 token）：

```bash
curl -s -X POST "http://127.0.0.1:17000/api/v1/analytics/jobs/aggregate-daily" \
  -H "Authorization: Bearer <accessToken>" -H "Content-Type: application/json" \
  -d "{\"statDate\":\"2026-04-28\"}"

curl -s "http://127.0.0.1:17000/api/v1/analytics/summary?startDate=2026-04-28&endDate=2026-04-28" \
  -H "Authorization: Bearer <accessToken>"
```

## 3. 运营端（§6.3）

1. `cd code/apps/operation-platform && pnpm dev`（默认 **3003**）。
2. 登录后打开首页仪表盘，查看 **「聚合看板（analytics-service / daily_stat）」** 区块。
3. 与同参 `GET /api/v1/analytics/overview?date=当日` 对照数值。

## 4. 旧库补索引

若 `POST .../jobs/aggregate-daily` 报唯一约束 / `ON CONFLICT` 相关错误：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_daily_stat_corp_date ON daily_stat (corp_id, stat_date);
```
