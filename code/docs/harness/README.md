# Harness：测试先行与迭代节奏

本目录说明如何按 [迭代计划-E2E.md](../迭代计划-E2E.md) 推进开发：**先写测试计划与用例，再实现代码，最后用单元测试 + E2E 验收**。

| 文档 | 说明 |
|------|------|
| [Sprint1-功能开发测试计划.md](./Sprint1-功能开发测试计划.md) | Sprint 1 功能点、开发计划、测试计划 |
| [Sprint2-功能开发测试计划.md](./Sprint2-功能开发测试计划.md) | Sprint 2（企微集成底座）功能点、开发计划、测试计划 |
| [本地启动与验证-Sprint1.md](./本地启动与验证-Sprint1.md) | 一页纸：启动顺序与 E2E 命令 |
| [本地启动与验证-Sprint2.md](./本地启动与验证-Sprint2.md) | Sprint 2：integration 健康检查与网关验证 |
| [迭代进度总览.md](./迭代进度总览.md) | Sprint 1–6 状态与下一步 |

## 命令速查（在 `code/` 下）

- **单元测试**：`pnpm test:unit`（Vitest：`shared-utils`、`gateway-service`、`auth-service`）
- **端到端**：`pnpm test:e2e`（Playwright，需先启动网关与各服务，见本地启动文档）
- **全量门禁**：`pnpm test`（含单元测试 + build + type-check + lint）

E2E 包位置：`code/e2e/`（`@scrm/e2e`）。
