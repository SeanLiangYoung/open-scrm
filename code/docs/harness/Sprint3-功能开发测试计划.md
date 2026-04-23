# Sprint 3 — 统一消息发送：功能点、开发计划与测试计划

对应 [迭代计划-E2E.md](../迭代计划-E2E.md) 第五节（Sprint 3）。

## 1. 功能点清单

| ID | 功能点 | 类型 | 验收 |
|----|--------|------|------|
| S3-F1 | `message-service` 幂等发送模型 | 新增 | 相同 `idempotency_key` 重复请求不产生重复副作用 |
| S3-F2 | 消息模板管理 API（CRUD） | 已有 | 模板列表、创建、编辑、删除正常 |
| S3-F3 | 通知中心 API（查询已读/未读） | 已有（前端页面已实现） | 后端 API 与前端对接正常 |
| S3-F4 | E2E：发送消息 → 状态查询 → 幂等验证 | 新增 | Playwright API E2E |
| S3-F5 | 发送测试页面（可选运营端） | 已有（前端页面已实现） | UI 反馈与 API 状态一致 |

**本仓库已落地（2026-04-23）**：S3-F2（模板管理 API）、S3-F3（通知中心 API）、S3-F5（MessageTemplate.vue + NotificationCenter.vue）。S3-F1（幂等发送模型）、S3-F4（E2E）待实现。

## 2. 开发计划（Harness 顺序）

1. **单元测试先行**：`message-service` 消息实体和服务层单测。
2. **幂等发送实现**：在 `message-service` 中增加幂等键逻辑（DB 唯一约束或 Redis 去重）。
3. **E2E**：新增 `sprint3-message.spec.ts`，覆盖发送 → 查询 → 幂等验证。
4. **回归**：`pnpm test:unit` → `pnpm type-check` →（可选）`pnpm test:e2e:sprint3`。

## 3. 测试计划

| 层级 | 工具 | 范围 | 命令 |
|------|------|------|------|
| 单元 | Vitest | `message-service` 消息实体、幂等逻辑 | `pnpm test:unit` |
| API E2E | Playwright `request` | 网关 → message-service 发送/查询/幂等 | `e2e/tests/sprint3-message.spec.ts` |
| 仓库门禁 | bash | build、type-check、lint | `pnpm test` |

## 4. 风险与依赖

- E2E 需 **gateway**、**message-service**、**PostgreSQL**、**Redis**；消息通道（短信/邮件）可用 Mock 验证发送流程。
- 幂等键设计：推荐在 `message_logs` 表加唯一索引 `(idempotency_key, create_time)` 窗口约束，或 Redis SETNX。

## 5. 与后续 Sprint 的边界

- **S4+**：数据分析看板消费 message-service 日志进行聚合。
- **S3 完成判定**：本文档「功能点清单」全部 ✅，且 [迭代进度总览](./迭代进度总览.md) 中 S3 更新为「已完成」。
