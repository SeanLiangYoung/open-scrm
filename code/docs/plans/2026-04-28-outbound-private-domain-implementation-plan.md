# 出海私域 RegionPack + 同意 spine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不破坏现有企微/消息/分析能力的前提下，为「出海私域 + 本地化 + AI 人审」落地 **文档契约、区域矩阵索引、Harness 索引**，并为后续 **Channel Adapter / Consent ledger** 预留明确 backlog 条目。

**Architecture:** 以 **RegionPack（JSON 或可版本化配置）** 描述国家/城市默认触点、节庆、支付提示、禁忌词类目；以 **ConsentPurpose + ConsentLedger** 为 EU 严格模式的数据契约草案（可先仅存于文档与 OpenAPI 草图，再落库）。AI 层仅允许 **human-in-the-loop** 路径进入现有或未来 message 流程。

**Tech Stack:** 现有 monorepo（Midway、PostgreSQL、Redis、Vue 运营端）；本计划 **首波以文档与类型草图为主**，避免无契约上大代码。

---

### Task 1: 确认设计文档为事实源入口

**Files:**

- Read: `code/docs/plans/2026-04-28-outbound-private-domain-localization-design.md`

**Step 1:** 通读设计文档「Epic E1–E6」与 [`2026-04-28-outbound-private-domain-user-scenarios-and-features.md`](./2026-04-28-outbound-private-domain-user-scenarios-and-features.md)（场景与能力映射），确认与干系人方向一致（若不一致，先修订设计 md 再编码）。

**Step 2:** Commit 仅文档时可用信息性 message（见 Task 5）。

---

### Task 2: 新增区域矩阵事实表（轻量 md）

**Files:**

- Create: `code/docs/facts/outbound-private-domain-region-matrix.md`

**Step 1:** 新建文件，用表格列出至少两行：**泰国（曼谷）**、**德国（柏林/EU）** — 列包括：`默认 IM`、`营销同意模式`、`支付提示`、`节庆钩子示例`、`禁忌词类别`、`时区`。

**Step 2:** 文末加「扩展行」模板（空表头占位），供后续加印尼 / 越南 / 阿联酋等。

**Step 3:** 在仓库根 `docs/README.md`「代码与工程」节增加指向该 facts 文件及设计/计划的链接（本计划已写入示例链接，执行时核对路径）。

**Step 4:** `git add` + `git commit -m "docs(facts): add outbound private domain region matrix"`

---

### Task 3: 更新 Harness「下一步」索引

**Files:**

- Modify: `code/docs/harness/迭代进度总览.md`（在「下一步（建议）」节追加子弹，不修改已完成 Sprint 表状态）

**Step 1:** 追加 2–3 条：**出海私域设计**链接、`implementation-plan` 链接、可选「Sprint7 主题候选：RegionPack + Consent spine 草案」。

**Step 2:** `git commit -m "docs(harness): link outbound private domain plans"`

---

### Task 4: Consent + RegionPack 数据契约 RFC（md，可选落 types）

**Files:**

- Create: `code/docs/plans/rfc-consent-regionpack.md`（或合并进 design 第二节附录；独立文件更易评审）

**Step 1:** 用伪代码 / TypeScript interface 草图定义：`ConsentRecord { subjectId, purpose, capturedAt, policyVersion, channel, locale }`、`RegionPack { countryCode, city?, defaultChannels, holidays[], tabooCategories[], paymentHints[] }`。

**Step 2:** 写明与现有 `message_log` / 租户模型的 **外键关系假设**（不写真实 migration，直至干系人批准）。

**Step 3:** `git commit -m "docs(rfc): consent ledger and region pack shapes"`

---

### Task 5: 单提交合并 Task 2–4（若已分步提交可 rebase squash，可选）

**Step 1:** `git status` 确认工作区干净。

**Step 2:** 若需单次交付：`git log -1 --oneline` 核对 message 符合 Conventional Commits。

---

### Task 6（后续阶段，非本 PR 必做）：Message Channel 接口桩

**Files（示例，实施前需再开计划）:**

- Modify: `packages/` 或 `services/message-service/` — 新增 `OutboundChannel` 接口与 `MockOutboundChannel`

**Step 1:** 设计评审通过后再写 **失败单测**（RED）：Mock 通道发送带 `regionCode` 负载。

**Step 2:** 最小实现（GREEN）与网关路由占位（若有）。

**Step 3:** E2E：`e2e/tests/sprint7-outbound-mock.spec.ts`（名称可按 harness 实际 Sprint 编号调整）。

---

## 执行交接（writing-plans 要求）

Plan complete and saved to `code/docs/plans/2026-04-28-outbound-private-domain-implementation-plan.md`.

**两种执行方式：**

1. **Subagent-Driven（本会话）** — 每个 Task 派生子代理并在 Task 间人工复核；配合 **superpowers:subagent-driven-development**。  
2. **Parallel Session（新会话）** — 新开会话加载 **superpowers:executing-plans** 批量执行并设检查点。

请选择其一；若未指定，默认建议 **2** 用于纯文档批次，**1** 用于后续带代码的 Task 6。
