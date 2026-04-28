# Sprint 4 — 分析聚合与看板：功能点、开发计划与测试计划

对应 [迭代计划-E2E.md](../迭代计划-E2E.md) 第六节（Sprint 4）。

**状态：✅ 已完成（2026-04-28）** — 核心交付已落地；浏览器看板 **§6.3** 为人工验收（与 API 同参对照），未单独增加 Playwright UI 用例（可放入 S6）。

## 1. 功能点清单

| ID | 功能点 | 验收 |
|----|--------|------|
| S4-F1 | `daily_stat` 唯一约束 `(corp_id, stat_date)` + `ON CONFLICT` 幂等 upsert | ✅ `init-db.pg.sql` |
| S4-F2 | 从 OLTP（customer / user / message_log / sop_execution / mass_task）聚合写入 `daily_stat` | ✅ `DailyAggregationService` |
| S4-F3 | 定时任务：每日 03:00 聚合**上一自然日**全企业 | ✅ `@midwayjs/cron` `DailyStatAggregationJob`；失败 `console.error` 占位 |
| S4-F4 | 手动触发：当前租户 `POST /api/v1/analytics/jobs/aggregate-daily` | ✅ |
| S4-F5 | 经网关 REST：`GET /overview`、`GET /summary`（`startDate`/`endDate`）及既有 daily/channel/staff | ✅ 控制器前缀 **`/api/v1/analytics`**（与网关一致，修正原 `/api/analytics` 无法经网关命中问题） |
| S4-F6 | 区间汇总纯函数单测 | ✅ `daily-stat-summary.util.spec.ts` |
| S4-F7 | operation-platform 仪表盘展示 `daily_stat` 概览 | ✅ `Dashboard.vue` 聚合卡片 + 先 POST 聚合再 GET overview |
| S4-F8 | API E2E | ✅ `sprint4-analytics.spec.ts`；`pnpm test:e2e:sprint4` |

## 2. 测试计划

| 层级 | 命令 |
|------|------|
| 单元 | `pnpm test:unit`（含 `@scrm/analytics-service`） |
| API E2E | `pnpm test:e2e:sprint4` |
| 运营端 §6.3 | 本地登录 `http://127.0.0.1:3003` 仪表盘，对照同参 `GET /api/v1/analytics/overview` |

## 3. 依赖与说明

- 需 **PostgreSQL**；旧卷若无 `ux_daily_stat_corp_date`，执行与 `init-db.pg.sql` 中一致的 `CREATE UNIQUE INDEX IF NOT EXISTS`。
- 聚合使用 `create_time::date` 与 `stat_date` 对齐，时区以数据库会话为准（开发环境默认同机）。

## 4. 完成判定

S4-F1～F8 全部 ✅，且 [迭代进度总览](./迭代进度总览.md) 中 S4 为「已完成」。
