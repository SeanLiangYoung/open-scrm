# Open SCRM 可执行迭代计划（含 E2E）

**文档版本:** 1.0  
**创建日期:** 2026-04-16  
**适用范围:** `code/` 目录（pnpm + Turborepo 单体仓库）

本文档与仓库根目录 [开发计划.md](../../docs/开发计划.md) 互补：前者记录历史阶段与规范，**本文档定义每个迭代的最终效果与端到端（E2E）验证流程**。迭代默认 **2 周**；若团队并行多条线，可按文末依赖关系调整顺序。代码与文档入口总览见 [代码现状与文档索引.md](./代码现状与文档索引.md)。

---

## 一、全局约定

### 1.1 端口与入口（开发环境）

| 组件 | 端口 | 说明 |
|------|------|------|
| gateway-service | 7000 | 对外 API 入口（`/api`） |
| auth-service | 7001 | 直连调试用，生产经网关 |
| customer-service | 7002 | 同上 |
| acquisition-service | 7003 | 同上 |
| operation-service | 7004 | 同上 |
| asset-service | 7005 | 同上 |
| analytics-service | 7006 | 同上 |
| integration-service | 7007 | 同上 |
| message-service | 7008 | 同上 |
| finance-service | 7009 | 同上 |
| admin-platform（Vite） | 3001 | `/api` 代理至 `VITE_GATEWAY_URL`（默认 `http://localhost:7000`） |
| operation-platform（Vite） | 3003 | 同上 |

使用 **Docker Compose** 启动网关时，宿主机通常为 **`http://localhost:17000`**（映射容器内 7000），E2E 与 `VITE_GATEWAY_URL` 需与此一致。

### 1.2 E2E 的两种形态

- **浏览器 E2E**：真实用户路径，在 Chrome 等浏览器中操作前端，经 Vite 代理访问网关。
- **API E2E**：使用 `curl` 或自动化脚本直连 **gateway:7000**，验证链路、状态码与关键字段（适合集成服务、回调、定时任务后的查询）。

每个迭代在「E2E 流程」中写明以哪种为主；**迭代完成**表示该迭代所列 E2E **全部按「完成判定」通过**。

### 1.3 全局前置条件（任一迭代开始前应满足）

从仓库根目录进入 `code/`：

1. 依赖已安装：`pnpm install`
2. 类型检查通过：`pnpm type-check`（或团队约定的 CI 等价命令）
3. **PostgreSQL** 与 **Redis** 已按项目说明启动，库 `scrm_dev` 可用（初始化脚本见 `code/scripts/init-db.pg.sql`）
4. 默认管理员：用户名 `admin`，密码 `Admin@123`（若变更以环境说明为准）

---

## 二、迭代总览

| 迭代 | 代号 | 主题 |
|------|------|------|
| Sprint 1 | S1 | 基线可运行 + 回归清单 |
| Sprint 2 | S2 | 企微集成底座（integration-service） |
| Sprint 3 | S3 | 统一消息发送（message-service） |
| Sprint 4 | S4 | 分析聚合与看板消费（analytics-service + 前端） |
| Sprint 5 | S5 | 获客与集成联动（acquisition-service） |
| Sprint 6 | S6 | 质量门禁 + 官网或移动端脚手架 |

---

## 三、Sprint 1 — 基线可运行与回归清单

### 3.1 最终效果

- 新成员可在 **≤30 分钟**（不含首次 Docker 镜像拉取）内完成：依赖安装 → 数据库就绪 → 启动网关与必要服务 → **管理端与运营端各完成一条主路径**。
- 存在一份**一页纸**的《本地启动与验证》（可为本节 E2E 的拷贝或链接），与真实命令一致。
- 当前已知 P0 缺陷为 **0**，或已登记负责人与目标迭代。

### 3.2 E2E 流程 A — 网关登录（API）

1. 启动 **gateway-service**（端口 **7000**）及 **auth-service**（**7001**），确保无启动异常。
2. 执行登录请求（路径以仓库内路由为准，以下为约定示例）：

```bash
curl -s -X POST http://localhost:7000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'
```

3. **完成判定：** HTTP 2xx；响应体包含可用于后续请求的 **token**（或 Cookie 方案与文档一致）；失败时有明确错误信息。

### 3.3 E2E 流程 B — 管理平台主路径（浏览器）

1. 启动 gateway + 本迭代所需后端服务（至少 auth + 依赖管理端的接口）。
2. 启动 admin-platform：`cd apps/admin-platform && pnpm dev`，打开 `http://localhost:3001`。
3. 使用 `admin` / `Admin@123` 登录。
4. 依次打开：**仪表盘** → **用户管理**（或列表页）→ **服务监控**（若存在），确认无白屏与未处理的前端错误。
5. **完成判定：** 登录成功；上述页面可加载；服务监控若展示多服务健康状态，与直接访问各服务健康检查一致（抽样至少 2 个服务）。

### 3.4 E2E 流程 C — 运营平台主路径（浏览器）

1. 启动 gateway + 运营相关服务（至少 customer、operation 等当前路由所需服务）。
2. 启动 operation-platform：`cd apps/operation-platform && pnpm dev`，打开 `http://localhost:3003`。
3. 登录后完成：**客户列表**进入一条记录或空列表正常 → **SOP 列表**可打开 → **群发任务**页面可打开（无则记录为缺口并延期）。
4. **完成判定：** 无阻塞性 404/500；核心列表页与详情/SOP 流程与后端数据一致（抽样 1 次创建或只读验证）。

---

## 四、Sprint 2 — 企微集成底座（integration-service）

### 4.1 最终效果

- **配置项清晰**：企业 ID、Secret、Token、EncodingAESKey、回调 URL 等在 `config` / 环境变量中有文档，**密钥不入库**。
- **解密与验签**：企业微信加密消息可解密（或测试向量通过单元测试）；异常有日志与错误码。
- **access_token**：Redis 缓存与过期刷新，并发下无重复风暴。
- **经网关可访问**：至少一个只读健康或探测接口 + 一个代表「集成已就绪」的接口（具体路径以实现为准）。

### 4.2 E2E 流程 A — 配置与只读探测（API）

1. 按文档设置测试环境变量（或 `.env.local`，勿提交密钥）。
2. 启动 integration-service、Redis、gateway。
3. 通过网关调用：**健康/就绪** 类接口（路径以代码为准）。

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:7000/api/v1/integration/health
```

（若实际路径不同，替换为仓库内 Swagger/路由表中的路径。）

4. **完成判定：** 返回 200；响应体表明依赖（Redis、配置）就绪。

### 4.3 E2E 流程 B — 解密与回调（API + 可选浏览器）

1. 使用**单元测试**或**企业微信调试工具**生成的样本密文，调用解密逻辑（直连 integration 或经网关，以安全要求为准）。
2. 模拟 GET 验证 URL 与 POST 消息回调（若已实现）。
3. **完成判定：** 解密结果与预期 XML/JSON 字段一致；GET 验证返回 `echostr` 明文；POST 返回 `success` 或文档规定的响应。

### 4.4 E2E 流程 C — Token 有效性（API）

1. 清空 Redis 中与 token 相关的 key（或首次启动）。
2. 连续两次调用需要 `access_token` 的外部接口封装（若暂无真实 API，可用「获取 token」内部接口代替）。
3. **完成判定：** 第二次请求命中缓存（日志或耗时明显下降）；token 过期后自动刷新且业务仍成功。

---

## 五、Sprint 3 — 统一消息发送（message-service）

### 5.1 最终效果

- 存在**统一发送模型**：渠道、模板、收件人、**幂等键**、发送状态可查。
- 至少一种通道落地：**短信**或**邮件**或**文档化 Mock 通道**（开发环境可验证「发送成功/失败」 observable）。
- **gateway** 暴露发送或查询类 API；与群发任务（operation-service）的对接关系有书面结论（已实现或 backlog）。

### 5.2 E2E 流程 A — 发送一条消息（API）

1. 启动 message-service、依赖中间件、gateway。
2. 使用测试模板或 Mock 通道，向本服务经网关发起「发送」请求（路径与 body 以 Swagger 为准），携带幂等键 `idempotency-key: test-sprint3-001`。
3. 立即重复相同请求。
4. **完成判定：** 第一次返回成功或明确失败原因；第二次**不产生重复副作用**（日志或数据库唯一约束或返回「重复」业务码）。

### 5.3 E2E 流程 B — 查询发送状态（API）

1. 用上一流程返回的 `messageId`（或等价 ID）查询状态接口。
2. **完成判定：** 状态与最终投递结果一致；终态可区分成功/失败/超时。

### 5.4 E2E 流程 C — 与运营端（可选浏览器）

1. 若本迭代提供「发送测试」或模板页：在 operation-platform 登录后完成一次测试发送。
2. **完成判定：** UI 反馈与 API 查询状态一致。

---

## 六、Sprint 4 — 分析聚合与看板（analytics-service）

### 6.1 最终效果

- 选定 **1～2 个核心指标**（如客户总数、SOP 执行次数），有**聚合表或汇总表**及迁移脚本。
- **定时任务**按约定频率写入聚合结果；失败可追踪（日志或告警占位）。
- **REST 查询 API**（支持时间范围）经网关可访问。
- **operation-platform** 至少一页（通常为仪表盘）展示真实聚合数据，与 API 抽样一致。

### 6.2 E2E 流程 A — 跑批后数据一致（API）

1. 在测试库插入或制造已知数据（如固定数量的客户或 SOP 执行记录）。
2. 手动触发或等待定时任务执行一次。
3. 调用聚合查询 API，时间范围覆盖测试数据。

```bash
# 示例：具体 path/query 以实现为准
curl -s "http://localhost:7000/api/v1/analytics/summary?from=2026-04-01&to=2026-04-30" \
  -H "Authorization: Bearer <token>"
```

4. **完成判定：** 返回数值与 SQL 独立统计结果一致（允许文档说明的舍入规则）。

### 6.3 E2E 流程 B — 看板展示（浏览器）

1. 登录 `http://localhost:3003`，打开**数据看板/仪表盘**（以路由为准）。
2. **完成判定：** 卡片或图表数字与 **E2E 流程 A** 同参下 API 返回一致；刷新后数据稳定（无随机数）。

---

## 七、Sprint 5 — 获客与集成联动（acquisition-service）

### 7.1 最终效果

- 一条**端到端业务主路径**打通：例如「创建获客渠道 → 保存外部渠道 ID → 模拟/真实事件经 integration 回写 → acquisition 侧可见更新」。
- 网关路由完整；敏感信息不落在 acquisition 的公开响应中。
- 若提供运营端页面：可完成列表 + 创建/编辑最小表单。

### 7.2 E2E 流程 A — 获客主路径（API + 集成）

1. 经网关创建渠道（或活码占位实体），记录返回 ID。
2. 模拟企业微信侧事件（或调用 integration 的测试入口）携带渠道标识。
3. 查询 acquisition 侧详情或统计接口，确认关联成功。
4. **完成判定：** 全链路数据可追溯；重复事件按设计幂等或去重。

### 7.3 E2E 流程 B — 运营端列表与创建（浏览器）

1. 登录 `http://localhost:3003`，进入获客相关菜单。
2. 新建一条渠道并保存；列表中可见；点进详情与 API 一致。
3. **完成判定：** 无 500；字段与后端 DTO 对齐（见迭代内联调记录）。

---

## 八、Sprint 6 — 质量门禁与扩展前端

### 8.1 最终效果

- **自动化 E2E**：至少覆盖「登录 + 一条业务操作」（工具选型与仓库现有脚本一致，如 Playwright/Cypress）。
- **网关路由表**或生成文档与代码同步，新增服务不会漏配。
- **二选一交付物**：  
  - **A.** `official-website`：可 `pnpm dev` 的首页与部署说明；或  
  - **B.** `mobile-app`：可运行的 UniApp 工程，含登录占位与一只读页。

### 8.2 E2E 流程 A — 自动化测试（CI 或本地）

1. 执行项目内约定的 E2E 命令（例如 `pnpm test:e2e`，以 `package.json` 为准）。
2. **完成判定：** 退出码 0；用例包含：打开登录页 → 登录 → 进入指定业务页并完成一次操作（与用例代码一致）。

### 8.3 E2E 流程 B — 官网或移动端（浏览器 / 模拟器）

**若选 A（官网）：**

1. `cd apps/official-website && pnpm dev`（或 Nuxt 等价命令）。
2. 打开首页，检查标题与导航；无控制台致命错误。
3. **完成判定：** 生产构建 `pnpm build` 成功（若已配置）。

**若选 B（移动端）：**

1. 使用 HBuilderX 或 CLI 启动到浏览器/模拟器（以项目 README 为准）。
2. 完成登录占位流程与只读页展示。
3. **完成判定：** 真机或模拟器可稳定打开；接口指向开发网关或 Mock 文档化。

### 8.4 E2E 流程 C — 路由表审查（人工 + 可选脚本）

1. 对照 gateway 配置列出所有 `/api` 前缀路由与上游服务端口。
2. 与本文档「端口与入口」及服务清单比对。
3. **完成判定：** 无遗漏；变更有 PR 说明。

---

## 九、迭代依赖关系

```text
S1 基线 ──► S2 集成 ──► S5 获客×集成 ──► S6 质量与扩展
                │
S1 ─────────────┼──► S3 消息 ──► S4 分析 ──► S6
```

- **S5 依赖 S2**：获客与企微/集成事件强相关时，应先完成集成底座。
- **S4 可与 S3 部分并行**，但需避免同时大改网关路由约定。
- **S6 的自动化 E2E 依赖 S1** 的稳定主路径；建议在 S1 结束即选定 E2E 工具并加最小用例，在 S6 扩展覆盖面。

---

## 十、文档维护

- 本文档随迭代更新：**每迭代结束时**更新「最终效果」是否达成，并修正 E2E 中已变更的 URL、端口、默认账号。
- 若 `vite` 端口、`/api` 前缀或登录接口路径变更，须同步修改 **第一节** 与对应 Sprint 的 E2E 步骤。

---

## 十一、Harness 执行材料

- **[harness/README.md](./harness/README.md)** — 测试先行命令、`test:unit` / `test:e2e` / `test:e2e:sprint2` 说明  
- **[harness/迭代进度总览.md](./harness/迭代进度总览.md)** — Sprint 1–6 完成状态  
- **[harness/Sprint1-功能开发测试计划.md](./harness/Sprint1-功能开发测试计划.md)** — Sprint 1 功能点与测试计划  
- **[harness/Sprint2-功能开发测试计划.md](./harness/Sprint2-功能开发测试计划.md)** — Sprint 2（企微集成底座）  
- **[harness/本地启动与验证-Sprint1.md](./harness/本地启动与验证-Sprint1.md)** — Sprint 1 一页纸  
- **[harness/本地启动与验证-Sprint2.md](./harness/本地启动与验证-Sprint2.md)** — Sprint 2 一页纸  

---

## 十二、修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-04-16 | 初版：六迭代效果 + E2E 流程 |
| 1.1 | 2026-04-18 | 增加 Harness 文档索引与 Sprint 1 落地 |
| 1.2 | 2026-04-19 | PostgreSQL/Docker 端口说明；Sprint 2 Harness 链接；开发计划链接修正 |
| 1.3 | 2026-04-23 | Sprint 2 标记为已完成；Sprint 3 前端页面已落地（模板管理、通知中心）；Sprint 3 harness 文档创建 |
