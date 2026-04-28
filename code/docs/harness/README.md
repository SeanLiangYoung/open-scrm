# Harness：测试先行与迭代节奏

本目录说明如何按 [迭代计划-E2E.md](../迭代计划-E2E.md) 推进开发：**先写测试计划与用例，再实现代码，最后用单元测试 + E2E 验收**。工程事实与文档入口总览见 [代码现状与文档索引.md](../代码现状与文档索引.md)。

| 文档 | 说明 |
|------|------|
| [Sprint1-功能开发测试计划.md](./Sprint1-功能开发测试计划.md) | Sprint 1 功能点、开发计划、测试计划 |
| [Sprint2-功能开发测试计划.md](./Sprint2-功能开发测试计划.md) | Sprint 2（企微集成底座）功能点、开发计划、测试计划 |
| [Sprint3-功能开发测试计划.md](./Sprint3-功能开发测试计划.md) | Sprint 3（统一消息、幂等经网关）功能点、开发计划、测试计划 |
| [Sprint4-功能开发测试计划.md](./Sprint4-功能开发测试计划.md) | Sprint 4（分析聚合、日任务、运营看板）功能点、开发计划、测试计划 |
| [Sprint5-功能开发测试计划.md](./Sprint5-功能开发测试计划.md) | Sprint 5（获客 × integration 联调）功能点、开发计划、测试计划 |
| [Sprint6-功能开发测试计划.md](./Sprint6-功能开发测试计划.md) | Sprint 6（质量门禁、网关路由表、官网、E2E 扩展） |
| [本地启动与验证-Sprint1.md](./本地启动与验证-Sprint1.md) | 一页纸：启动顺序与 E2E 命令 |
| [本地启动与验证-Sprint2.md](./本地启动与验证-Sprint2.md) | Sprint 2：integration 健康检查、企微回调、网关与故障排查 |
| [本地启动与验证-Sprint3.md](./本地启动与验证-Sprint3.md) | Sprint 3：message-service、幂等发送 E2E、旧库补列说明 |
| [本地启动与验证-Sprint4.md](./本地启动与验证-Sprint4.md) | Sprint 4：analytics 聚合、summary、运营端对照 |
| [本地启动与验证-Sprint5.md](./本地启动与验证-Sprint5.md) | Sprint 5：获客 API、integration 测试入口、E2E |
| [本地启动与验证-Sprint6.md](./本地启动与验证-Sprint6.md) | Sprint 6：官网 dev/build、全量 E2E、路由表对照 |
| [迭代进度总览.md](./迭代进度总览.md) | Sprint 1–6 状态与下一步 |

## 命令速查（在 `code/` 下）

- **单元测试**：`pnpm test:unit`（Vitest：`shared-utils`、`gateway-service`、`auth-service`、`integration-service`、`message-service`、`analytics-service`）
- **端到端**：`pnpm test:e2e`（Playwright，需先启动网关与各服务，见本地启动文档）
- **Sprint 2 仅 API**：`pnpm test:e2e:sprint2`（无需前端，默认网关 `http://127.0.0.1:17000`）
- **Sprint 3 仅 API**：`pnpm test:e2e:sprint3`（需 gateway + auth + message + DB；见 [本地启动与验证-Sprint3.md](./本地启动与验证-Sprint3.md)）
- **Sprint 4 仅 API**：`pnpm test:e2e:sprint4`（需 gateway + auth + analytics + DB；见 [本地启动与验证-Sprint4.md](./本地启动与验证-Sprint4.md)）
- **Sprint 5 仅 API**：`pnpm test:e2e:sprint5`（需 gateway + auth + acquisition + integration + Redis + DB；见 [本地启动与验证-Sprint5.md](./本地启动与验证-Sprint5.md)）
- **Sprint 6 仅官网 E2E**：`pnpm test:e2e:sprint6-official`（需已启动 `official-website`；见 [本地启动与验证-Sprint6.md](./本地启动与验证-Sprint6.md)）
- **全量门禁**：`pnpm test`（含单元测试 + build + type-check + lint）

E2E 包位置：`code/e2e/`（`@scrm/e2e`）。
