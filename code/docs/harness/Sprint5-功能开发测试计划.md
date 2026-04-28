# Sprint 5 — 获客与集成联动：功能点、开发计划与测试计划

对应 [迭代计划-E2E.md](../迭代计划-E2E.md) 第七节（Sprint 5）。

**状态：✅ 已完成（2026-04-28）** — API + 联调路径落地；[迭代进度总览](./迭代进度总览.md)。

## 1. 功能点清单

| ID | 功能点 | 验收 |
|----|--------|------|
| S5-F1 | 经网关创建渠道活码（统一到 `/api/v1/acquisition`） | ✅ `POST /api/v1/acquisition/channel-codes`；公开响应不返回 `configId` |
| S5-F2 | 列表 / 详情 | ✅ `GET /channel-codes`、`GET /channel-codes/:id` |
| S5-F3 | integration 测试入口 → 调用 acquisition 扫码回写 | ✅ `POST /api/v1/integration/test/acquisition-channel-scan`（转发 Bearer） |
| S5-F4 | 重复事件幂等 | ✅ `externalEventId` + Redis 去重 |
| S5-F5 | 运营端获客页走新 API | ✅ `ChannelManage.vue` 使用 `/api/v1/acquisition/channel-codes` |
| S5-F6 | API E2E | ✅ `sprint5-acquisition.spec.ts`；`pnpm test:e2e:sprint5` |

## 2. 测试路由开关

- **`POST /api/v1/integration/test/*`**：`NODE_ENV !== 'production'` 时默认开启；生产需显式 `ENABLE_INTEGRATION_TEST_ROUTES=1`。**禁止**在未评估风险的生产环境打开。
- `integration` 调 `acquisition` 使用配置 `integration.acquisitionServiceUrl`（默认 `http://localhost:7003`，容器内需环境变量指向 acquisition 服务）。

## 3. Backlog

- 真实企微回调 XML 解析 State → 自动调用 `ingest-scan` 等价逻辑（与 `ch_{id}_{channel}` 对齐）。
- 活码「编辑」PUT 接口、平台账号 `/api/v1/acquisition` 版本化。

## 4. 完成判定

S5-F1～F6 ✅，且 [迭代进度总览](./迭代进度总览.md) 中 S5 为「已完成」。
