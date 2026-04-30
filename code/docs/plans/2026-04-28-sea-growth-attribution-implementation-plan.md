# 东南亚增长为主 + 归因为辅 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 **不削弱** 现有 `consent_record` / `consentPurpose` 闸门与统一消息幂等的前提下，落地 **B 为主**（频控、静默、区域策略、进线编排、COD 轻闭环）与 **C 为辅**（身份键、事件 taxonomy 最小集、一页看板），均可被单元测试与 API E2E 验收。

**Architecture:** 发送路径保持 **`MessageApiController.send` →（同意闸门已有）→ 策略闸门（新增）→ `MessageSendService.sendMessage`**。策略状态以 **Redis 计数滑动/日历日桶** 为主（低延迟），**RegionPack** 提供时区与默认阈值（先扩展 `code/services/message-service/src/catalog/region-packs.ts`，可选再落 `send_policy` 表做租户覆盖）。辅线 **C** 以 **只读文档契约 + 最小写入契约**（`message_log.extra` / `acquisition` 已有字段的字典）为主，避免在未定口径前大面积改 `daily_stat` schema。

**Tech Stack:** Midway 3、TypeORM、PostgreSQL、Redis（message-service 已配置）、网关 `gateway-service`、Vitest（`message-service` / `operation-service`）、Playwright API E2E（`code/e2e/`）、运营端 Vue 3（`code/apps/operation-platform`）。

**设计依据：** [2026-04-28-sea-growth-primary-attribution-secondary-design.md](./2026-04-28-sea-growth-primary-attribution-secondary-design.md)、[2026-04-28-outbound-private-domain-localization-design.md](./2026-04-28-outbound-private-domain-localization-design.md)。

---

## 执行原则（全局）

- **TDD**：先写失败单测 → 跑红 → 最小实现 → 跑绿 → 再提交（见 @test-driven-development）。
- **顺序**：同意闸门 **已存在** → 新增策略闸门永远在 **`sendMessage` 之前**；若策略与合规冲突，**拒绝发送** 并返回明确 `message` / `code`。
- **工作目录**：下列命令均在 `code/` 下执行，除非注明仓库根。

---

### Task 0: 契约文档（C 辅线先行，零运行时依赖）

**Files:**

- Create: `code/docs/facts/attribution-identity-keys-v0.1.md`
- Create: `code/docs/facts/attribution-event-taxonomy-v0.1.md`

**Step 1:** 在 `attribution-identity-keys-v0.1.md` 中固定：**`link_id`（或等价）**、**`first_touch_utm`**、**`region_pack_id`**、**`external_userid` / customer.id** 的优先级与冲突规则（多设备、多 IM 占位说明）；写明与 `message_log.extra`、`acquisition` 扫码事件的 **字段对齐表**（仅文档，不写臆造 API）。

**Step 2:** 在 `attribution-event-taxonomy-v0.1.md` 中列出 **≤12 个** 事件名（例：`ad.click`、`landing.view`、`im.add_friend`、`im.first_reply`、`order.placeholder`），每行：**事件名、必选属性、写入方服务、是否进入 daily_stat 对齐**（若本阶段不入库，标为「Phase C+」）。

**Step 3:** `git add` 上述两文件 + `git commit -m "docs(facts): attribution identity keys and event taxonomy v0.1"`

---

### Task 1: 扩展 RegionPack（策略维度数据，无 UI）

**Files:**

- Modify: `code/services/message-service/src/catalog/region-packs.ts`
- Modify: `code/services/message-service/src/catalog/region-packs.spec.ts`

**Step 1（RED）：** 在 `region-packs.spec.ts` 中新增用例：对 `th-bangkok` 期望存在字段，例如 `maxMarketingSendsPerRecipientPerDay: number`、`silentLocalHours: { start: '22:00', end: '08:00' }`（具体键名以你实现为准，**先写断言再改类型**）。

**Step 2：** 运行  
`pnpm --filter @scrm/message-service exec vitest run src/catalog/region-packs.spec.ts`  
**预期：** FAIL（类型或字段缺失）。

**Step 3（GREEN）：** 扩展 `RegionPack` 接口与 `REGION_PACKS` 常量中 `th-bangkok` / `de-berlin` 的上述字段（柏林可用更严默认值以体现差异）。

**Step 4：** 再运行同一 vitest 命令，**预期：** PASS。

**Step 5：** `pnpm test:unit`（仓库根在 `code/`）确认无回归。

**Step 6：** `git commit -m "feat(message): extend RegionPack with policy defaults for SEA"`

---

### Task 2: 策略评估纯函数（静默 + 日频控）

**Files:**

- Create: `code/services/message-service/src/util/outbound-send-policy.util.ts`
- Create: `code/services/message-service/src/util/outbound-send-policy.util.spec.ts`

**Step 1（RED）：** 在 spec 中定义并测试纯函数，例如：

```ts
evaluateOutboundSendPolicy(input: {
  now: Date;
  pack: RegionPack; // 已含 timezone + silent + max... 
  localSendCountForDay: number;
}): { allowed: boolean; reasonCode?: 'silent_hours' | 'frequency_cap' }
```

- 用例 1：`localSendCountForDay` 已等于 `max...`，`allowed === false`，`reasonCode === 'frequency_cap'`。
- 用例 2：`now` 映射到 pack 时区后落在静默窗内，`allowed === false`，`reasonCode === 'silent_hours'`。

**Step 2：** `pnpm --filter @scrm/message-service exec vitest run src/util/outbound-send-policy.util.spec.ts` → **FAIL**（函数未实现）。

**Step 3（GREEN）：** 实现 `evaluateOutboundSendPolicy`（建议用 `Intl`/`Date` 或轻量依赖如 `dayjs` + `timezone`——**若引入新依赖须走 pnpm workspace 评审**；优先 **原生** 计算 UTC 偏移以避免新依赖）。

**Step 4：** vitest → **PASS**；`pnpm type-check`。

**Step 5：** `git commit -m "feat(message): outbound send policy evaluator (silent + frequency)"`

---

### Task 3: Redis 计数与策略服务（Midway）

**Files:**

- Create: `code/services/message-service/src/service/outbound-policy-state.service.ts`（或 `send-policy.service.ts`）
- Create: `code/services/message-service/src/service/outbound-policy-state.service.spec.ts`（对 Redis **可 mock**：注入 `RedisService` 的 test double，或抽出 `getCount`/`incr` 接口便于 mock）

**Step 1（RED）：** 单测描述行为：`recordAndCheckPolicy(corpId, packId, recipientKey)` 在首次调用返回 `allowed: true`，在超过 `maxMarketingSendsPerRecipientPerDay` 后返回 `allowed: false`（mock Redis `INCR` 返回值序列）。

**Step 2：** 实现服务：Redis key 建议形如  
`msg:policy:{corpId}:{packId}:{recipientType}:{recipientId}:{yyyyMMdd}`  
**仅对 `consentPurpose === 'marketing'` 且发送将被接受的路径计数**（避免事务性消息误占额度；若本阶段仅营销计数，在代码注释与 Harness 中写明）。

**Step 3：** `pnpm test:unit` + `pnpm type-check`。

**Step 4：** `git commit -m "feat(message): Redis-backed outbound policy state for marketing sends"`

---

### Task 4: 接入 `MessageApiController`（HTTP 429 或 403 约定）

**Files:**

- Modify: `code/services/message-service/src/controller/message-api.controller.ts`
- Modify: `code/services/message-service/src/dto/send-message.dto.ts`（新增可选 `regionPackId?: string`，`@Rule` optional；与纯函数入参绑定）
- Read: `code/services/message-service/src/util/marketing-consent-gate.util.ts`（保持同意优先顺序）

**Step 1（RED）：** 在 `code/e2e/tests/sprint8-outbound.spec.ts` **同文件或新建** `sprint9-sea-policy.spec.ts` 增加用例：对同一客户、同一 `regionPackId=th-bangkok`、`consentPurpose=marketing`，连续发送直到触发 `frequency_cap`（需 **幂等键每条不同** 或单条多 target 禁止——遵循现有幂等规则）。断言 HTTP 状态与 body.message。

**Step 2：** 跑 E2E 前确保网关与 message 已起；执行  
`pnpm test:e2e:sprint8` 或新 script（若你新增 project，见 Task 6）  
**预期：** 新用例 **FAIL**。

**Step 3（GREEN）：** 在 controller 中：`getTenantContext` → consent gate（已有）→ **解析 `regionPackId`（缺省则用租户默认，首版可硬编码默认 `th-bangkok` 仅开发租户）** → `evaluateOutboundSendPolicy` + Redis 计数 → 不通过则 `ctx.status = 429`（或 **409**；**团队需统一**，文档与客户端一致即可）并 `return { success: false, message, code: '...' }`。

**Step 4：** E2E **PASS**；`pnpm test:unit`。

**Step 5：** `git commit -m "feat(message): enforce RegionPack policy on marketing sends"`

---

### Task 5: 双语 / 督导字段（模板 `extra` 约定，可选后端校验）

**Files:**

- Modify: `code/services/message-service/src/dto/message-template.dto.ts`（若需显式字段则加 optional；否则仅文档）
- Create: `code/docs/facts/message-template-extra-locale-convention.md`

**Step 1:** 文档约定 `message_template.extra` JSON 形状示例：

```json
{
  "customerLocale": "th-TH",
  "supervisorSummaryZh": "高意向-促销A",
  "tabooPackId": "th-bangkok"
}
```

**Step 2（可选 RED）：** 若加 DTO 校验，写 Vitest 针对 DTO 或 `MessageTemplateService.createTemplate` 的校验逻辑。

**Step 3:** `git commit -m "docs(facts): message template extra locale convention"`

---

### Task 6: Harness 与 E2E 脚本

**Files:**

- Modify: `code/docs/harness/本地启动与验证-Sprint8.md` 或 **新建** `code/docs/harness/本地启动与验证-Sprint9-sea-policy.md`
- Modify: `code/docs/harness/迭代进度总览.md`
- Modify: `code/e2e/playwright.config.ts`（如需新 `project`）
- Modify: `code/package.json`（`test:e2e:sprint9` / `test:e2e:api` 串联）

**Step 1:** 记录：**策略闸门依赖 Redis**；默认 RegionPack；E2E 网关 URL 与 Sprint3/8 一致。

**Step 2:** `git commit -m "docs(harness): SEA policy E2E and runbook"`

---

### Task 7（Phase B — P1）：TikTok / 广告进线 → IM（MVP）

**Files:**

- Modify: `code/services/acquisition-service/`（或 `integration-service` 已有测试扫码入口：`code/e2e/tests/sprint5-acquisition.spec.ts` 可查路径）
- Modify: `code/services/customer-service/`（若需在客户实体上挂 `last_attribution_json` 占位列）
- Create: `code/e2e/tests/sprint9-acquisition-attribution.spec.ts`（名称可调整）

**Step 1:** 选定 **唯一入口**：优先扩展现有 **测试/正式** 扫码或 webhook 转发 API，使 body 可携带 `utm_campaign`、`creative_id`、`region_pack_id`（字段名与 Task 0 字典 **一致**）。

**Step 2（RED）：** E2E：模拟进线 → 查询客户或事件表（若仅日志，则断言 `message_log.extra` 带关键键）——**先失败**。

**Step 3（GREEN）：** 最小持久化（可仅存 `customer.extra` JSON 或独立 `customer_touch` 表——**YAGNI 优先 JSON 列** 若已有 `extra`）。

**Step 4:** `git commit -m "feat(acquisition): persist ad touch ids on inbound scan MVP"`

---

### Task 8（Phase B — P1）：COD / 支付轻闭环（占位状态机）

**Files:**

- Create: `code/docs/plans/2026-04-28-cod-light-loop-states.md`（状态枚举与 API 草图）
- （可选）`code/services/operation-service/` 新表或复用工单 — **建议本计划仅文档 + 一条 mock API**，避免过大范围

**Step 1:** 文档定义状态：`intent` → `awaiting_payment_proof` → `shipped` → `delivered`；与 **单独频控策略键**（如 `messageCategory: 'cod_reminder'`）在 Task 2 纯函数中可插拔。

**Step 2:** 评审后再开独立 implementation plan；本 Task 以 **commit 文档** 结束。

---

### Task 9（Phase C — 辅线收口）：analytics 只读 API 或 SQL 视图

**Files:**

- Modify: `code/services/analytics-service/` 下现有 overview/summary 控制器（路径以 `code/docs/facts/gateway-routes.md` 为准）
- Create: `code/docs/facts/funnel-metrics-v0.1.md`（定义「归因缺口率」分子分母）

**Step 1:** 若 `daily_stat` 尚无字段：本阶段 **仅新增只读聚合** 从 `message_log` + `customer` 计算占位漏斗（可能较慢，限开发租户或加 `date` 参数）。

**Step 2（RED）：** Vitest 对 **纯函数** `computeFunnelGaps(...)` 在 `analytics-service` 若合适；否则仅 E2E 断言 API 返回结构。

**Step 3:** `git commit -m "feat(analytics): funnel gap placeholder endpoint"`

---

## 建议里程碑（排序）

| 顺序 | 里程碑 | 包含 Task |
|------|--------|-----------|
| M1 | 文档契约可评审 | 0 |
| M2 | 频控+静默可演示（无真实 BSP） | 1–4, 6 |
| M3 | 模板双语约定落地 | 5 |
| M4 | 进线归因字段持久化 | 7 |
| M5 | COD 状态机定稿（文档先行） | 8 |
| M6 | 漏斗缺口只读 | 9 |

---

## 验证命令速查

```bash
cd code
pnpm test:unit
pnpm type-check
pnpm test:e2e:sprint9    # RegionPack 频控 + 扫码归因 + funnel-gap 占位（需栈齐）
pnpm test:e2e:sprint8   # Consent / RegionPack 基线（可与 Sprint9 互补）
```

---

## 执行状态（2026-04-28 收口）

| Task | 状态 |
|------|------|
| 0 契约文档 | ✅ `docs/facts/attribution-identity-keys-v0.1.md`、`attribution-event-taxonomy-v0.1.md` |
| 1–3 RegionPack + 纯函数 + Redis 状态 | ✅ `message-service` |
| 4 发送路径策略闸门 | ✅ `MessageApiController` + E2E `sprint9-sea-policy` |
| 5 模板 extra 约定 | ✅ `docs/facts/message-template-extra-locale-convention.md` |
| 6 Harness | ✅ `docs/harness/本地启动与验证-Sprint9.md`、`README`、迭代总览 S9 行 |
| 7 扫码归因 MVP | ✅ `channel_scan_touch` + acquisition API + E2E `sprint9-acquisition` |
| 8 COD 占位 | ✅ `docs/plans/2026-04-28-cod-light-loop-states.md` |
| 9 漏斗缺口占位 | ✅ `computeAttributionGapMetrics` + `GET .../funnel-gap-placeholder` + `funnel-metrics-v0.1.md` + E2E `sprint9-funnel-gap` |
| Task 5 可选（extra 校验） | ✅ `validateMessageTemplateExtra` + `MessageTemplateService` create/update |
| Task 8 可选（COD mock） | ✅ `GET|POST /api/v1/operation/cod-mock/state`（内存占位） |
| ANA-01 切片（OLTP 漏斗） | ✅ `FunnelGapQueryService` + `resolveFunnelGapWindow`；占位路径改为读 `message_log` / `customer` / `channel_scan_touch` |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | 初版：从 B主C辅设计拆为可执行 Task；与现有 message / consent / RegionPack 对齐 |
| 2026-04-28 | 收口：Task 0–9 落地；`pnpm test:e2e:sprint9`、Harness Sprint9、实现状态表 |
| 2026-04-28 | 文档循环：`迭代计划-E2E` v1.10（§二 Sprint 9、§2.5.3 落地 / §2.5.4 Backlog）、`代码现状与文档索引` 测试命令与 S9 链接、`迭代进度总览` Backlog 锚点改为 §2.5.4 |
| 2026-04-28 | Task5/8 可选与 ANA-01 切片：模板 extra 校验、COD mock API、funnel OLTP 聚合与文档 / E2E 调整 |
