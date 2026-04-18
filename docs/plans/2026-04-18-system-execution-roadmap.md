# Open SCRM 分阶段实施路线

> **目标：** 按「实现难度低、需求边界清晰」优先，逐步把微服务与网关行为对齐到可交付状态。

**原则：** 先打通横切能力（租户、服务间调用），再扩展 SRS 中的大模块（多平台获客、BI 等）。

---

## Phase A — 租户与网关上下文（✅ 第一迭代已完成 2026-04-18）

**难度：** 低  
**清晰度：** 高（网关已转发 `x-corp-id` / `x-user-id`）

- 在 `@scrm/server-common` 提供 `getTenantContext(ctx)`，优先读网关头，再回退 `ctx.state.user`，默认企业 1。
- 各业务 Controller 与 customer/tag Service 去掉写死的 `corpId = 1`。
- 群发任务调用 message-service / customer-service 时携带 `taskRequestHeaders`（`x-corp-id` / `x-user-id`）。
- finance `PaymentService` 使用 `getTenantContext` 解析订单所属企业。

**验收：** 经网关访问时 `corpId`/`userId` 与登录用户一致；直连单服务时仍可用默认值 1。

---

## Phase B — 服务间编排闭环（✅ 第一迭代已完成 2026-04-18）

**难度：** 中  
**清晰度：** 中高（代码里已有 TODO 与 URL 配置）

- **customer-service**：`GET /api/v1/customers/lookup?externalUserid=` + `findByExternalUserid`，供集成侧幂等写入。
- **operation-service**：`SopExecutionService` 按步骤类型 HTTP 调用 message（发消息 / 推送素材 / 站内通知）、customer（打标签、分配）；`actionContent` 支持 JSON 对象或字符串。
- **integration-service**：`WeworkApiService.addContactWay` + `POST /api/wework/contact-way`；`WeworkSyncService` 部门/员工列表写入 Redis，客户同步按通讯录拉取员工并遍历外部联系人，调用 customer upsert；配置项 `integration.customerServiceUrl`、`integration.scrmCorpId`（默认 `SCRM_TENANT_ID=1`）。
- **acquisition-service**：创建渠道活码时请求 integration `contact-way`，失败或未配 staff 时回退本地占位二维码。

**验收：** 核心运营链路可在多服务联调下跑通（不依赖手工改库）。

**后续：** 部门/员工与 SCRM 用户体系映射、活码与回调统计、SOP 异步队列化仍待迭代。

---

## Phase C — 消息与集成深化

**难度：** 中偏高  
**清晰度：** 中（依赖外部平台文档）

- message-service：短信/邮件等通道抽象（若 SRS 需要再选供应商）。
- integration-service：企微加解密、回调与错误重试策略。

---

## Phase D — 规格中的大模块（按需拆分）

**难度：** 高  
**清晰度：** 需产品切片（SRS 3.1～3.4 范围大）

- 多平台内容发布、门店、海报、完整 BI —— 按子域拆里程碑与原型，避免一次性铺开。

---

## Phase E — 前端占位应用

- `official-website`、`mobile-app`：在 Phase A/B 稳定后再启动（或单独里程碑）。
