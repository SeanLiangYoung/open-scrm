# Open SCRM 可执行迭代计划（含 E2E）

**文档版本:** 1.11  
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
| Sprint 7 | S7 | 工程延续：E2E 进 CI + 群发与统一消息联调（S3-F7） |
| Sprint 8 | S8 | 出海私域 Phase 1：RegionPack / Consent 契约落地 + Outbound Mock 通道与闸门 E2E |
| Sprint 9 | S9 | SEA 增长 + 归因辅线：营销频控/静默、`channel_scan_touch`、analytics 漏斗占位、`pnpm test:e2e:sprint9` |

---

<a id="next-sprints-s7-s8"></a>

## 二点五、下一阶段迭代总览（S7–S9，草案 + 已落地）

> 与 [出海私域产品设计](./plans/2026-04-28-outbound-private-domain-localization-design.md)、[用户场景与功能映射](./plans/2026-04-28-outbound-private-domain-user-scenarios-and-features.md)、[实现计划](./plans/2026-04-28-outbound-private-domain-implementation-plan.md) 对齐。**S7 以工程债与联调为主**；**S8 以出海「可跑切片」为主**；**S9** 见 [东南亚增长 + 归因实现计划](./plans/2026-04-28-sea-growth-attribution-implementation-plan.md)（不绑定真实 WABA/LINE BSP，除非干系人另行拍板）。

### 2.5.1 Sprint 7 — 工程延续（优先）

| 工作项 | 类型 | 完成判定（摘要） |
|--------|------|------------------|
| **CI 门禁** | 工程 | ✅ `.github/workflows/ci.yml`：`code/` 下 `pnpm install` → `pnpm test:unit` → `pnpm type-check`；失败阻断合并。**说明**：全量 Playwright 仍依赖本机/Compose 起栈，未进同一 job（与下项「E2E 进 CI」理想态仍有差距）。 |
| **S3-F7 群发 × 统一消息** | 功能 | ✅ 运营群发走 `POST /api/v1/messages/send`；幂等键 `mass-task-{taskId}-tgt-{targetId}`；`operation-service` Vitest；见 [Sprint3-功能开发测试计划](./harness/Sprint3-功能开发测试计划.md) S3-F7。 |
| **getAccessToken 并发观测（可选）** | 技术债 | 文档或脚本验证「双请求命中同一 Redis key」无风暴；或登记延期至 S8 后。 |

**S7 E2E 主形态**：以 **API E2E + 现有浏览器用例在 CI 中子集重跑** 为主；全量三前端 E2E 可放在夜间或手动 job。

### 2.5.2 Sprint 8 — 出海私域 Phase 1（契约 + Mock）

**状态（2026-04-28）**：以下为一 **可跑最小切片**；与下表「理想完成判定」未逐字对齐处见 [本地启动与验证-Sprint8.md](./harness/本地启动与验证-Sprint8.md) 的 Backlog 说明。

| 工作项 | 类型 | 完成判定（摘要） |
|--------|------|------------------|
| **RegionPack** | 契约 | ✅ `message-service` 内 **`src/catalog/region-packs.ts`**（`th-bangkok`、`de-berlin`）+ Vitest；租户绑定 `default_region_pack_id` 仍为 Backlog。 |
| **Consent Ledger 最小表** | 契约 | ✅ 表 `consent_record` + `init-db.pg.sql` 种子（客户 1 marketing 同意）；**写入/撤回 API** 未做。 |
| **Outbound Mock 通道** | 功能 | ✅ `messageType: 5` + `consentPurpose` 营销闸门（客户 `targetType:1` + `consent_record`）；请求体 **`regionPackId` 未强制**。 |
| **API E2E** | 测试 | ✅ `e2e/tests/sprint8-outbound.spec.ts`；`pnpm test:e2e:sprint8`。**「撤回后再发失败」** 未自动化，列为 Backlog。 |

**S8 明确不在范围（除非单独开 Sprint）**：真实 WABA/LINE BSP 联调、运营端完整 AI 坐席 UI、CMP 双端落地页。

### 2.5.3 Sprint 9 — SEA 增长为主 + 归因为辅（已落地，2026-04-28）

**状态**：可跑最小切片；Task 0–9 与代码路径见 [sea-growth-attribution-implementation-plan.md](./plans/2026-04-28-sea-growth-attribution-implementation-plan.md)。

| 工作项 | 类型 | 完成判定（摘要） |
|--------|------|------------------|
| **RegionPack 策略闸门** | 功能 | ✅ 营销单聊：`consent` 闸门 → `OutboundPolicyStateService`（静默优先，Redis 日历日桶）；未知 pack **400**；静默/超 cap **429** + `code`（`silent_hours` / `frequency_cap`）；E2E `sprint9-sea-policy`（`test-e2e-policy`）。 |
| **扫码归因 MVP** | 功能 | ✅ `channel_scan_touch` + `ingest-scan` 归因字段 + `GET .../scan-touches/latest`；integration 测试入口转发完整 body；E2E `sprint9-acquisition-attribution`。 |
| **漏斗占位** | 分析 | ✅ `computeAttributionGapMetrics` + Vitest；`GET /api/v1/analytics/funnel-gap-placeholder`；[funnel-metrics-v0.1.md](./facts/funnel-metrics-v0.1.md)；E2E `sprint9-funnel-gap`。 |
| **文档契约** | 契约 | ✅ Task 0 facts、[message-template-extra-locale-convention.md](./facts/message-template-extra-locale-convention.md)、[2026-04-28-cod-light-loop-states.md](./plans/2026-04-28-cod-light-loop-states.md)。 |

**S9 E2E**：`pnpm test:e2e:sprint9`（`e2e/run-sprint9-api.sh`）；需 **gateway、auth、message、redis、postgres、acquisition、integration、analytics** 与表 `channel_scan_touch`。一页纸：[本地启动与验证-Sprint9.md](./harness/本地启动与验证-Sprint9.md)。

**与 S3 并存**：发送 DTO 的 **`extra`** 仍写入 **`message_log.extra`**（`utm_*` 等）；S9 增加活码 touch 落库与分析占位接口；**ANA-01** 级真实聚合仍属后续 Phase。

<a id="backlog-s9-plus"></a>

### 2.5.4 Sprint 10+（Backlog，不排期）

- 真实 **WABA / LINE OA** 适配器与 BSP 配置；东南亚多国 Pack 批量导入。  
- **AI 人审**（草稿/摘要/路由）与审计日志产品化。  
- **ANA-01** 全链路 UTM→订单与看板（消费 `message_log.extra` + `channel_scan_touch`，替换 funnel 占位）。

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

1. **单元测试**：`integration-service` 内 `wework-msg-crypt.util.spec.ts`（含 `verifyWeworkMsgSignature` 与加解密对拍）。
2. **经网关自动化**：`pnpm test:e2e:sprint2`（Playwright）覆盖  
   `GET /api/v1/integration/wework/callback`（URL 验证，响应体为解密后的明文）、  
   `POST /api/v1/integration/wework/callback`（`Content-Type: text/xml`，成功时响应体为明文 `success`）。  
   需数据库 `wework_config` 已配置 `callback_token`、`encoding_aes_key`（新库见 `code/scripts/init-db.pg.sql` 种子；旧库见 [本地启动与验证-Sprint2](./harness/本地启动与验证-Sprint2.md) §3.1）。
3. **网关**：`AuthMiddleware` 白名单须包含上述回调路径；`bodyParser` 须将 `text/xml` 解析为字符串以便代理转发 POST 体（见 `gateway-service` 实现）。
4. **完成判定：** 在有效签名与密文下 GET/POST 返回 200，且与 Harness「S2 已完成」状态一致。

### 4.4 E2E 流程 C — Token 有效性（API）

1. 清空 Redis 中与 token 相关的 key（或首次启动）。
2. 连续两次调用需要 `access_token` 的外部接口封装（若暂无真实 API，可用「获取 token」内部接口代替）。
3. **完成判定：** 第二次请求命中缓存（日志或耗时明显下降）；token 过期后自动刷新且业务仍成功。

---

## 五、Sprint 3 — 统一消息发送（message-service）

### 5.1 最终效果

- 存在**统一发送模型**：渠道、模板、收件人、**幂等键**、发送状态可查。
- 至少一种通道落地：**短信**或**邮件**或**文档化 Mock 通道**（开发环境可验证「发送成功/失败」 observable）。**已落地**：`messageType === 2`（站内通知）作为 Mock 通道（无外部 HTTP），详见 [Sprint3-功能开发测试计划.md](./harness/Sprint3-功能开发测试计划.md) S3-F5。
- **gateway** 暴露发送或查询类 API（**已落地**：`POST /api/v1/messages/send`、`GET /api/v1/messages/logs/:id`）。与群发任务（operation-service）的对接：**已落地（Sprint 7）**（见 [Sprint3-功能开发测试计划.md](./harness/Sprint3-功能开发测试计划.md) S3-F7）。

### 5.2 E2E 流程 A — 发送一条消息（API）

1. 启动 message-service、auth-service、依赖中间件、gateway。
2. 先 `POST {GATEWAY}/api/v1/auth/login` 取得 `accessToken`；再 `POST {GATEWAY}/api/v1/messages/send`，Header：`Authorization: Bearer <token>`，可选 **`Idempotency-Key`**（与 body 的 `idempotencyKey` 二选一或一致；**头优先**；二者冲突则 400）。Body 示例（Mock 通道）：`messageType: 2`，`targetType` / `targetIds`（**使用幂等键时 `targetIds` 仅 1 个**）、`content`。**仓库用例**：`code/e2e/tests/sprint3-messages.spec.ts`；命令：`cd code && pnpm test:e2e:sprint3`。
3. 立即重复相同请求（相同 `Idempotency-Key` 与等价 body）。
4. **完成判定：** 第一次返回成功或明确失败原因；第二次**不产生重复副作用**，响应中带 **`idempotentReplay: true`** 且 **`messageLogId`** 与第一次一致（或依赖 DB 唯一约束 + 服务端重放逻辑）。

### 5.3 E2E 流程 B — 查询发送状态（API）

1. 用上一流程返回的 **`messageLogId`**（见 `data.details[0].messageLogId` 或幂等重放时的 `data.messageLogId`）调用 **`GET {GATEWAY}/api/v1/messages/logs/:id`**（Bearer 同上）。
2. **完成判定：** 状态与最终投递结果一致；终态可区分成功/失败（`sendStatus`：0 待发送 / 1 成功 / 2 失败）。

### 5.4 E2E 流程 C — 与运营端（可选浏览器）

1. 若本迭代提供「发送测试」或模板页：在 operation-platform 登录后完成一次测试发送。
2. **完成判定：** UI 反馈与 API 查询状态一致。

---

## 六、Sprint 4 — 分析聚合与看板（analytics-service）

### 6.1 最终效果

- 选定 **1～2 个核心指标**（如客户总数、SOP 执行次数），有**聚合表或汇总表**及迁移脚本。**已落地**：`daily_stat`（`init-db.pg.sql` + 唯一索引 `ux_daily_stat_corp_date`）；核心指标含**累计客户**、**SOP 执行次数**（见 `DailyAggregationService`）。
- **定时任务**按约定频率写入聚合结果；失败可追踪（日志或告警占位）。**已落地**：`DailyStatAggregationJob`（每日 **03:00** 聚合上一自然日）；手动 `POST /api/v1/analytics/jobs/aggregate-daily`。
- **REST 查询 API**（支持时间范围）经网关可访问。**已落地**：`GET /api/v1/analytics/summary?startDate=&endDate=`、`GET /api/v1/analytics/overview?date=` 等（Bearer 必带）。
- **operation-platform** 至少一页（通常为仪表盘）展示真实聚合数据，与 API 抽样一致。**已落地**：`Dashboard.vue`「聚合看板」区块；§6.3 建议人工对照同参 `overview`。

### 6.2 E2E 流程 A — 跑批后数据一致（API）

1. 在测试库插入或制造已知数据（如固定数量的客户或 SOP 执行记录）。**开发种子**：`init-db.pg.sql` 中 `customer` 8 条（`corp_id=1`）。
2. 手动触发或等待定时任务执行一次。推荐：`POST {GATEWAY}/api/v1/analytics/jobs/aggregate-daily`，body `{"statDate":"YYYY-MM-DD"}`（省略则默认当天）。
3. 调用聚合查询 API，时间范围覆盖测试数据。

```bash
curl -s "http://127.0.0.1:17000/api/v1/analytics/summary?startDate=2026-04-28&endDate=2026-04-28" \
  -H "Authorization: Bearer <token>"
```

4. **完成判定：** 返回数值与 SQL 独立统计结果一致（允许文档说明的舍入规则）。**自动化**：`code/e2e/tests/sprint4-analytics.spec.ts`（聚合后 `overview.totalCustomerCount === 8`）。

### 6.3 E2E 流程 B — 看板展示（浏览器）

1. 登录 `http://localhost:3003`，打开**数据看板/仪表盘**（以路由为准）。
2. **完成判定：** 「聚合看板（analytics-service / daily_stat）」与 **E2E 流程 A** 同参下 `GET /api/v1/analytics/overview?date=当日` 一致；刷新后数据稳定（无随机数）。**说明**：当前仓库以人工对照为主；全链路 Playwright UI 可放入 Sprint 6 扩展。

---

## 七、Sprint 5 — 获客与集成联动（acquisition-service）

### 7.1 最终效果

- 一条**端到端业务主路径**打通：例如「创建获客渠道 → 保存外部渠道 ID → 模拟/真实事件经 integration 回写 → acquisition 侧可见更新」。**已落地**：`POST /api/v1/acquisition/channel-codes` 创建活码；`POST /api/v1/integration/test/acquisition-channel-scan`（测试入口，见 Harness）转发扫码至 `POST /api/v1/acquisition/channel-codes/:id/ingest-scan`；`GET /api/v1/acquisition/channel-codes/:id` 查看 `scanCount`。
- 网关路由完整；敏感信息不落在 acquisition 的公开响应中。**已落地**：列表/详情/创建响应使用 `toPublicChannel`，**不包含 `configId`**。
- 若提供运营端页面：可完成列表 + 创建/编辑最小表单。**已落地**：列表 + 新建走 v1 API；**编辑**仍为占位提示（Backlog）。

### 7.2 E2E 流程 A — 获客主路径（API + 集成）

1. 经网关创建渠道（或活码占位实体），记录返回 ID。示例：`POST {GATEWAY}/api/v1/acquisition/channel-codes`，Bearer + JSON `{ "codeName", "channel" }`。
2. 模拟企业微信侧事件（或调用 integration 的测试入口）携带渠道标识。示例：`POST {GATEWAY}/api/v1/integration/test/acquisition-channel-scan`，body `{ "channelCodeId": <id>, "externalEventId"?: "可选幂等键" }`（路由开关见 [本地启动与验证-Sprint5.md](./harness/本地启动与验证-Sprint5.md)）。
3. 查询 acquisition 侧详情或统计接口，确认关联成功。示例：`GET {GATEWAY}/api/v1/acquisition/channel-codes/<id>`。
4. **完成判定：** 全链路数据可追溯；重复事件按设计幂等或去重。**自动化**：`code/e2e/tests/sprint5-acquisition.spec.ts`；命令 `cd code && pnpm test:e2e:sprint5`。

### 7.3 E2E 流程 B — 运营端列表与创建（浏览器）

1. 登录 `http://localhost:3003`，进入获客相关菜单（路由 **渠道活码** `/channels`）。
2. 新建一条渠道并保存；列表中可见；与 `GET /api/v1/acquisition/channel-codes` 字段对齐（`codeName`、`scanCount` 等）。
3. **完成判定：** 无 500；字段与后端 DTO 对齐。编辑能力见 Sprint5 Harness Backlog。

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
S1 基线 ──► S2 集成 ──► S5 获客×集成 ──► S6 质量与扩展 ──► S7 工程延续
                │                                                      │
S1 ─────────────┼──► S3 消息 ──► S4 分析 ──► S6 ─────────────────────┘
                │                              │
                └──────────────────────────────┴──► S8 出海 Phase1（依赖 S3 消息与 S6 门禁基线）
```

- **S5 依赖 S2**：获客与企微/集成事件强相关时，应先完成集成底座。
- **S4 可与 S3 部分并行**，但需避免同时大改网关路由约定。
- **S6 的自动化 E2E 依赖 S1** 的稳定主路径；建议在 S1 结束即选定 E2E 工具并加最小用例，在 S6 扩展覆盖面。
- **S7 依赖 S6**：CI 与门禁脚本以 S6 产出为基线；S3-F7 依赖 S3 消息 API 已稳定。
- **S8 依赖 S3 + S7（建议）**：Mock 出站发送复用统一消息与幂等；Consent 闸门需消息层可携带 `consentPurpose`；S7 完成 CI 后更易保护 S8 回归。

---

## 十、文档维护

- 本文档随迭代更新：**每迭代结束时**更新「最终效果」是否达成，并修正 E2E 中已变更的 URL、端口、默认账号。
- 若 `vite` 端口、`/api` 前缀或登录接口路径变更，须同步修改 **第一节** 与对应 Sprint 的 E2E 步骤。

---

## 十一、Harness 执行材料

- **[harness/README.md](./harness/README.md)** — 测试先行命令、`test:unit` / `test:e2e` / `test:e2e:sprint2` … `test:e2e:sprint5` / `test:e2e:sprint8` / `test:e2e:sprint9` / `test:e2e:sprint6-official` 说明  
- **[facts/gateway-routes.md](./facts/gateway-routes.md)** — 网关 `gateway.routes` 与上游端口事实表（Sprint 6）  
- **[harness/迭代进度总览.md](./harness/迭代进度总览.md)** — Sprint 1–9 状态与下一步（随 S7–S9 推进更新）  
- **[plans/2026-04-28-outbound-private-domain-localization-design.md](./plans/2026-04-28-outbound-private-domain-localization-design.md)** — 出海私域产品设计（东南亚 + EU 锚点）  
- **[harness/Sprint1-功能开发测试计划.md](./harness/Sprint1-功能开发测试计划.md)** — Sprint 1 功能点与测试计划  
- **[harness/Sprint2-功能开发测试计划.md](./harness/Sprint2-功能开发测试计划.md)** — Sprint 2（企微集成底座）  
- **[harness/Sprint3-功能开发测试计划.md](./harness/Sprint3-功能开发测试计划.md)** — Sprint 3（统一消息、幂等经网关）  
- **[harness/Sprint4-功能开发测试计划.md](./harness/Sprint4-功能开发测试计划.md)** — Sprint 4（分析聚合与看板）  
- **[harness/Sprint5-功能开发测试计划.md](./harness/Sprint5-功能开发测试计划.md)** — Sprint 5（获客 × 集成）  
- **[harness/Sprint6-功能开发测试计划.md](./harness/Sprint6-功能开发测试计划.md)** — Sprint 6（质量门禁、官网、E2E 扩展）  
- **[harness/本地启动与验证-Sprint1.md](./harness/本地启动与验证-Sprint1.md)** — Sprint 1 一页纸  
- **[harness/本地启动与验证-Sprint2.md](./harness/本地启动与验证-Sprint2.md)** — Sprint 2 一页纸（含企微回调与故障排查）  
- **[harness/本地启动与验证-Sprint3.md](./harness/本地启动与验证-Sprint3.md)** — Sprint 3 一页纸（消息 API 与 E2E）  
- **[harness/本地启动与验证-Sprint4.md](./harness/本地启动与验证-Sprint4.md)** — Sprint 4 一页纸（analytics 与运营端）  
- **[harness/本地启动与验证-Sprint5.md](./harness/本地启动与验证-Sprint5.md)** — Sprint 5 一页纸（获客与 integration 测试入口）  
- **[harness/本地启动与验证-Sprint6.md](./harness/本地启动与验证-Sprint6.md)** — Sprint 6 一页纸（官网、全量 E2E、路由表）  
- **[harness/本地启动与验证-Sprint8.md](./harness/本地启动与验证-Sprint8.md)** — Sprint 8 一页纸（Consent 闸门、`messageType:5`、E2E `test:e2e:sprint8`）  
- **[harness/本地启动与验证-Sprint9.md](./harness/本地启动与验证-Sprint9.md)** — Sprint 9 一页纸（SEA 策略、`channel_scan_touch`、`test:e2e:sprint9`）  

---

## 十二、修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-04-16 | 初版：六迭代效果 + E2E 流程 |
| 1.1 | 2026-04-18 | 增加 Harness 文档索引与 Sprint 1 落地 |
| 1.2 | 2026-04-19 | PostgreSQL/Docker 端口说明；Sprint 2 Harness 链接；开发计划链接修正 |
| 1.3 | 2026-04-28 | Sprint 2 收尾：经网关企微回调 GET/POST、Harness 标记 S2 已完成（见 `docs/harness/`） |
| 1.4 | 2026-04-28 | Sprint 3 收尾：message-service 幂等、`/api/v1/messages`、E2E `test:e2e:sprint3`、Harness S3 文档与总览 |
| 1.5 | 2026-04-28 | Sprint 4：`daily_stat` 日聚合 Cron + 手动任务、`/api/v1/analytics`、operation 仪表盘、E2E `test:e2e:sprint4`、Harness S4 |
| 1.6 | 2026-04-28 | Sprint 5：`/api/v1/acquisition/channel-codes*`、integration 测试扫码转发、运营活码页、E2E `test:e2e:sprint5`、Harness S5 |
| 1.7 | 2026-04-28 | Sprint 6：`gateway-routes.md`、运营端新建活码 E2E、`official-website`（:3010）、`sprint6-official`、`run-full-e2e` 三前端、Harness S6 |
| 1.8 | 2026-04-28 | 增加 **S7/S8** 下一阶段迭代总览（E2E 进 CI、S3-F7、出海 Phase1 Mock+Consent）；更新依赖图与 Harness 索引说明 |
| 1.9 | 2026-04-28 | **S7/S8 最小切片落地**：GitHub Actions 单元+类型检查；S3-F7 群发联调；`consent_record` + 营销闸门 + `messageType:5` + RegionPack 静态目录 + `sprint8-outbound` E2E；§2.5.1–2.5.3 与 Sprint 3 §5.1 同步事实；**S9** `extra`/UTM 文档说明 |
| 1.10 | 2026-04-28 | **S9 实现收口写入主计划**：§二 增加 Sprint 9 行；**§2.5.3** 改为 S9 已落地（频控、`channel_scan_touch`、funnel 占位、E2E）；原 Backlog 移至 **§2.5.4**（锚点 `backlog-s9-plus` 保留）；Harness 索引补充 Sprint 9 |
| 1.11 | 2026-04-28 | **§二点五** 标题与导语对齐 S9；外链 [sea-growth-attribution-implementation-plan](./plans/2026-04-28-sea-growth-attribution-implementation-plan.md) |
