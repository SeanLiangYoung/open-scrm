# Harness：测试先行与迭代节奏

夜间可靠性批次见根目录 [量化计划](../../../docs/plans/2026-10-25-overnight-execution.md)。新增隔离入口：`bash scripts/test/overnight-customer-postgres.sh`（PostgreSQL16/TypeORM/跟进控制器）、`bash scripts/test/overnight-sop-postgres.sh`（SOP替换事务回滚与并发），以及 `node scripts/test/overnight-consent-http.cjs`（PostgreSQL16/Redis/真实 auth→gateway→message HTTP 闭环）。它们创建并清理专用临时资源，不能替代全量 E2E。`.github/workflows/ci.yml` 已配置 `isolated-business-flows` 作业复用三个入口并归档证据；未推送运行前仅代表配置完成，不代表远程 CI 已通过。

第二条真实HTTP入口为 `node scripts/test/overnight-customer-http.cjs`，通过两个企业真实登录验证跟进创建/列表与双向跨企业拒绝，也已加入隔离CI作业。运营浏览器请求契约使用 `pnpm --filter @scrm/e2e exec playwright test --config operation-contracts.config.ts`，所有API模拟，单独CI作业安装Chromium并运行；与真实后端HTTP证据分开计数。

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
| [本地启动与验证-Sprint8.md](./本地启动与验证-Sprint8.md) | Sprint 8：Consent 闸门、`messageType:5` Mock、`pnpm test:e2e:sprint8` |
| [本地启动与验证-Sprint9.md](./本地启动与验证-Sprint9.md) | Sprint 9：RegionPack 营销频控/静默、`channel_scan_touch`、analytics 漏斗占位、`pnpm test:e2e:sprint9` |
| [迭代进度总览.md](./迭代进度总览.md) | Sprint 1–9 状态与下一阶段摘要；权威见 [迭代计划-E2E §2.5](../迭代计划-E2E.md#next-sprints-s7-s8) |

## 当前隔离验收入口

使用 `node scripts/test/verify-reliability.cjs --group all --report-dir /tmp/scrm-verification-new` 串行执行当前注册阶段。可分别选择 `static`、`browser`、`database`、`http`；报告目录须为新目录。每阶段保存日志、退出码和耗时，缺少依赖会明确跳过并使整体失败，不会自动下载或连接现有数据库。详见[统一入口说明](../../../docs/tests/2026-10-26-unified-verification-runner.md)。

CI复用上述分组：static包含8项工程门禁与登录竞态检查，browser包含14个模拟API套件，database包含10个隔离数据库阶段，http包含22个实际HTTP/UI/启动阶段；static另含编排自检，共注册50阶段（注册不等于最新全跑通过）。五服务启动显式使用无真实凭据的OSS夹具，仅证明启动与数据库健康。默认缺少OSS配置的失败另有报告；不表示真实对象存储或外部渠道送达。远程CI尚未执行。

## 命令速查（在 `code/` 下）

- **单元测试**：`pnpm test:unit`（Vitest：`shared-utils`、`gateway-service`、`auth-service`、`integration-service`、`message-service`、`analytics-service`、`operation-service`、`acquisition-service`）
- **端到端**：`pnpm test:e2e`（Playwright，需先启动网关与各服务，见本地启动文档）
- **Sprint 2 仅 API**：`pnpm test:e2e:sprint2`（无需前端，默认网关 `http://127.0.0.1:17000`）
- **Sprint 3 仅 API**：`pnpm test:e2e:sprint3`（需 gateway + auth + message + DB；见 [本地启动与验证-Sprint3.md](./本地启动与验证-Sprint3.md)）
- **Sprint 4 仅 API**：`pnpm test:e2e:sprint4`（需 gateway + auth + analytics + DB；见 [本地启动与验证-Sprint4.md](./本地启动与验证-Sprint4.md)）
- **Sprint 5 仅 API**：`pnpm test:e2e:sprint5`（需 gateway + auth + acquisition + integration + Redis + DB；见 [本地启动与验证-Sprint5.md](./本地启动与验证-Sprint5.md)）
- **Sprint 6 仅官网 E2E**：`pnpm test:e2e:sprint6-official`（需已启动 `official-website`；见 [本地启动与验证-Sprint6.md](./本地启动与验证-Sprint6.md)）
- **Sprint 8 仅 API**：`pnpm test:e2e:sprint8`（需 gateway + auth + message + DB 含 `consent_record`；见 [本地启动与验证-Sprint8.md](./本地启动与验证-Sprint8.md)）
- **Sprint 9 仅 API**：`pnpm test:e2e:sprint9`（需 gateway + auth + message + redis + acquisition + integration + analytics + DB 含 `channel_scan_touch`；见 [本地启动与验证-Sprint9.md](./本地启动与验证-Sprint9.md)）
- **Content Studio 仅 API**：`pnpm test:e2e:content-studio`（需 gateway + auth + acquisition + content-generation + Redis + DB；见 [本地启动与验证-ContentStudio.md](./本地启动与验证-ContentStudio.md)）
- **全量门禁**：`pnpm test`（含单元测试 + build + type-check + lint）

E2E 包位置：`code/e2e/`（`@scrm/e2e`）。

实际UI工具的安全回归另用 `node scripts/test/check-business-ui-harness-safety.cjs`：七条工具缺少专用配置时拒绝子服务启动，并真实创建容器后注入start失败，独立确认清理与非零退出。它不启动数据库服务，不计入50阶段编排；CI另设此步。

续办三组补充PG命令在统一50之外：node scripts/test/overnight-channel-scan-postgres.cjs、node scripts/test/overnight-studio-identifiers-postgres.cjs、node scripts/test/overnight-admin-user-postgres.cjs；扫码清理另有overnight-channel-scan-postgres.selfcheck.cjs。CI增加独立步骤，不把独立组数叠加成50业务用例。范围和最新实际结果见../../../docs/tests/2026-10-26-resumed-delivery.md。
