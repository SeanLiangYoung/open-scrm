# Sprint 6 — 功能开发测试计划（质量门禁 + 官网）

与 [迭代计划-E2E.md](../迭代计划-E2E.md) **§八** 对齐。

## 交付清单

| 项 | 说明 | 状态 |
|----|------|------|
| 网关路由事实表 | `code/docs/facts/gateway-routes.md` 与 `gateway-service` `config.default.ts` 同步 | 已完成 |
| E2E 流程 A | `sprint1-operation.spec.ts` 含「登录 + 渠道管理新建活码」；`pnpm test:e2e` 退出码 0（需网关 + acquisition + DB） | 与全量 E2E 同参验证 |
| E2E 流程 B（选 A） | `apps/official-website`：Vite + Vue 首页；`pnpm dev` / `pnpm build` | 已完成 |
| 全量 E2E 脚本 | `e2e/run-full-e2e.sh` 拉起 `:3010` 并跑 `sprint6-official` | 已完成 |

## 命令

- 全量（需网关与各后端）：在 `code/` 执行 `pnpm test:e2e`
- 仅官网用例（需已手动 `pnpm --filter @scrm/official-website dev`）：`pnpm test:e2e:sprint6-official`

## Backlog

- CI 矩阵中仅跑 API 子集时，可不包含 `sprint6-official`（依赖 Vite 进程）。
