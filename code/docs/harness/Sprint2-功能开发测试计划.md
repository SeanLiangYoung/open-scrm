# Sprint 2 — 企微集成底座：功能点、开发计划与测试计划

对应 [迭代计划-E2E.md](../迭代计划-E2E.md) 第四节（Sprint 2）。

**状态：✅ 已完成（2026-04-28 收尾）** — 功能点已全部勾选；迭代总览见 [迭代进度总览.md](./迭代进度总览.md)。

## 1. 功能点清单

| ID | 功能点 | 类型 | 验收 |
|----|--------|------|------|
| S2-F1 | 经网关只读健康/就绪：`GET /api/v1/integration/health` | 已有 / 增强 | ✅ 200；`status: ok`；**数据库 + Redis** 状态可查 |
| S2-F2 | 回调 URL 验签（SHA1）可单测 | 新增 | ✅ `verifyWeworkCallbackSignature`（三参）+ `verifyWeworkMsgSignature`（企微四参：含密文）Vitest |
| S2-F3 | 企微消息体 AES-256-CBC 解密可单测 | 新增 | ✅ `decryptWeworkMessage` 与加密对拍或向量用例 |
| S2-F4 | Access Token Redis 缓存（业务已有） | 已有 | ✅ 代码路径 `getAccessToken` + Redis；关键逻辑以单测覆盖纯函数为主；未单独做并发压测（见迭代计划「加厚」可选项） |
| S2-F5 | E2E：经网关探测 integration | 已有 / 对齐 | ✅ Playwright `sprint2-integration.spec.ts`：health + **GET/POST wework/callback** |
| S2-F6 | 配置与密钥：环境变量命名、不在日志打印 Secret | 持续 | ✅ `config.default` + 本文档；密钥不入库；**Code Review 持续检查**（与仓库根 [开发计划.md](../../../docs/开发计划.md) 原则对齐） |

### S2 E2E 未通过的常见原因（已排查）

1. **integration 容器/进程起不来**：`mw build` 曾把 `src/**/*.spec.ts` 打进 `dist/`，运行时加载了 Vitest 导致崩溃。已在 `integration-service/tsconfig.json` 中 **`exclude: ["**/*.spec.ts"]`**（与 gateway/auth 一致），**改代码后需重新 `docker compose build integration-service` 或本地 `mw build`**。
2. **响应缺少 `redis` 字段**：多为旧镜像/旧进程；重建后 `/api/v1/integration/health` 会返回 `redis: connected|disconnected`。
3. **回调用例 503**：`wework_config` 无种子行（旧数据卷未跑新 init）；见 [本地启动与验证-Sprint2.md](./本地启动与验证-Sprint2.md) §3.1 手动 INSERT。
4. **仅跑 API E2E**：`cd code && pnpm test:e2e:sprint2`（不必先起前端）；完整 `pnpm test:e2e` 仍见 [README](./README.md)。

## 2. 开发计划（Harness 顺序）

1. **冻结契约**：`/api/v1/integration/health` JSON 形状（含 `redis`）；网关路由 `/api/v1/integration/*` 不变。
2. **单元测试先行**：验签 + 加解密纯函数（红 → 绿）。
3. **实现**：`wework-msg-crypt.util.ts`；`WeworkApiService` 委托工具函数；`IntegrationApiController.health` 增加 Redis 探测；**经网关企微回调** `GET|POST /api/v1/integration/wework/callback`。
4. **E2E**：更新 Sprint 2 用例断言；网关 + integration + DB + Redis 启动后全绿。
5. **回归**：`pnpm test:unit` → `pnpm type-check` →（可选）`pnpm test:e2e`。

## 3. 测试计划

| 层级 | 工具 | 范围 | 命令 |
|------|------|------|------|
| 单元 | Vitest | `integration-service` `wework-msg-crypt.util` | `pnpm test:unit`（含 `@scrm/integration-service`） |
| API E2E | Playwright `request` | 网关 → integration health + wework callback | `e2e/tests/sprint2-integration.spec.ts` |
| 仓库门禁 | bash | build、type-check、lint | `pnpm test` |

## 4. 风险与依赖

- E2E 需 **gateway**、**integration-service**、**PostgreSQL**、**Redis**；端口以 [本地启动与验证-Sprint2.md](./本地启动与验证-Sprint2.md) 为准。
- 企微**真实** `access_token` 依赖外网与企业凭证；本 Sprint 以**纯函数单测**为主，不在 CI 调企微 API。

## 5. 与后续 Sprint 的边界

- **S3+**：消息发送幂等、群发联动等在 message/operation 迭代中扩展。
- **S2 完成判定**：本文档「功能点清单」全部 ✅，且 [迭代进度总览](./迭代进度总览.md) 中 S2 为「已完成」。
