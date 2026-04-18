# Sprint 1 — 功能点、开发计划与测试计划

对应 [迭代计划-E2E.md](../迭代计划-E2E.md) 第三节（基线可运行 + 回归清单）。

## 1. 功能点清单

| ID | 功能点 | 类型 | 验收 |
|----|--------|------|------|
| F1 | 网关健康检查 `GET /health` | 已有 | JSON 含 `status: ok` |
| F2 | 经网关登录 `POST /api/v1/auth/login` | 已有 | 返回 `accessToken` / `refreshToken` |
| F3 | 管理平台：登录 → 仪表盘 → 用户 → 服务监控 | 已有 | 无阻塞错误 |
| F4 | 运营平台：登录 → 看板 → 客户列表 / SOP / 群发 | 已有 | 路由与页面可打开 |
| F5 | 网关路由匹配逻辑可单测 | 新增 | `findMatchingGatewayRoute` Vitest 覆盖 |
| F6 | 密码强度策略可单测 | 新增 | `checkPasswordStrength` Vitest 覆盖 |
| F7 | 共享校验工具单测 | 新增 | `validate.util` 抽样覆盖 |
| F8 | E2E：API + 双端浏览器 | 新增 | Playwright，`code/e2e` |

## 2. 开发计划（Harness 顺序）

1. **冻结契约**：登录响应形状、网关 `/health`、前端登录页占位符（测试依赖）。
2. **单元测试先行**：路由匹配、密码强度、validate 工具（红 → 绿）。
3. **实现/重构**：提取纯函数（`route-match.ts`、`password-strength.util.ts`），保持业务行为不变。
4. **E2E**：编写 Playwright；未启动服务时 skip，避免误报失败。
5. **回归**：`pnpm test` 全量门禁。

## 3. 测试计划

| 层级 | 工具 | 范围 | 命令 |
|------|------|------|------|
| 单元 | Vitest | `packages/shared-utils`、`gateway`（route-match）、`auth`（password-strength） | `pnpm test:unit` |
| API E2E | Playwright `request` | 网关 health、登录 | `e2e/tests/sprint1-api.spec.ts` |
| UI E2E | Playwright | admin 3001、operation 3003 | `sprint1-admin.spec.ts`、`sprint1-operation.spec.ts` |
| 仓库门禁 | bash | build、type-check、lint | `pnpm test` |

## 4. 风险与依赖

- E2E 依赖 **MySQL 中有 admin 用户**；密码须与策略一致（当前默认 `Admin@123`）。
- 运营端客户/SOP 接口依赖 **customer-service、operation-service**；未启动时页面可能报错，与「主路径可走通」冲突时需先起服务。
