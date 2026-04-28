# Sprint 3 — 统一消息发送：功能点、开发计划与测试计划

对应 [迭代计划-E2E.md](../迭代计划-E2E.md) 第五节（Sprint 3）。

**状态：✅ 已完成（2026-04-28）** — 功能点已全部勾选；迭代总览见 [迭代进度总览.md](./迭代进度总览.md)。

## 1. 功能点清单

| ID | 功能点 | 类型 | 验收 |
|----|--------|------|------|
| S3-F1 | 幂等键规范化与重放判定（纯函数） | 新增 | ✅ `message-idempotency.util.ts` + Vitest |
| S3-F2 | `message_log.idempotency_key` + 部分唯一索引 `(corp_id, idempotency_key)` | 新增 | ✅ `init-db.pg.sql`；实体 `MessageLogEntity` |
| S3-F3 | 单条发送幂等：预查重放、单 target、并发 `23505` 再查重放 | 新增 | ✅ `MessageSendService.sendMessage` + `message-send.service.spec.ts` |
| S3-F4 | 经网关 REST：`POST /api/v1/messages/send`、`GET /api/v1/messages/logs/:id` | 新增 | ✅ `MessageApiController`；头 `Idempotency-Key` 优先于 body，冲突返回 400 |
| S3-F5 | Mock 可观测通道（开发环境） | 文档化 | ✅ `messageType === 2`（站内通知，`doSendMessage` 无外部调用即成功）；E2E 默认使用该类型 |
| S3-F6 | API E2E | 新增 | ✅ `e2e/tests/sprint3-messages.spec.ts`；`pnpm test:e2e:sprint3` |
| S3-F7 | 与群发任务（operation-service）联动 | Backlog | 本迭代未改群发；结论：**后续迭代**在 operation 调本 API 或消息队列时对齐幂等键与状态查询（见迭代计划 §5.1） |

## 2. 开发计划（Harness 顺序）

1. **契约**：幂等键长度与规范化规则；重放响应字段 `idempotentReplay`、`messageLogId`、`sendStatus` 等。
2. **单元测试先行**：`message-idempotency` 红 → 绿；`sendMessage` 行为用 Vitest + 仓储 mock 补契约。
3. **实现**：DTO、实体、DB 索引、`MessageSendService`、新控制器。
4. **E2E**：登录 → 两次同键发送 → 断言重放；`GET /logs/:id` 查状态。
5. **回归**：`pnpm test:unit`（含 `@scrm/message-service`）→ `pnpm exec turbo run build --filter=@scrm/message-service`。

## 3. 测试计划

| 层级 | 工具 | 范围 | 命令 |
|------|------|------|------|
| 单元 | Vitest | `message-service` 幂等工具 + `sendMessage` 分支 | `pnpm test:unit`（含 `@scrm/message-service`） |
| API E2E | Playwright `request` | 网关 → auth 登录 → messages send / logs | `pnpm test:e2e:sprint3` 或 `pnpm test:e2e:api` |
| 仓库门禁 | turbo | build、type-check、lint | `pnpm test` |

## 4. 风险与依赖

- E2E 需 **gateway**、**auth-service**、**message-service**、**PostgreSQL**（表 `message_log` 含 `idempotency_key` 与索引）。旧数据卷若缺列，参见 [本地启动与验证-Sprint3.md](./本地启动与验证-Sprint3.md)。
- 网关路由 `/api/v1/messages/*` 已在 `gateway-service` 配置；**需 Bearer Token**（不在 Auth 白名单）。

## 5. 完成判定

本文档「功能点清单」中 **S3-F1～F6** 全部 ✅，且 [迭代进度总览](./迭代进度总览.md) 中 S3 为「已完成」。
