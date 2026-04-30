# 归因身份键与字段对齐（v0.1）

> **状态**：事实契约草案，与 [东南亚增长+归因实现计划](../plans/2026-04-28-sea-growth-attribution-implementation-plan.md) Task 0 对齐。  
> **范围**：广告 / 落地 / IM 串联的 **键优先级** 与 **落库字段对齐**；不定义尚未存在的 HTTP 路径。

---

## 1. 身份键优先级（解析「同一次旅程」）

| 优先级 | 键 | 说明 |
|--------|-----|------|
| P1 | `corp_id` + `customer.id`（内部客户主键） | CRM 内唯一；跨渠道合并的最终锚点（多 IM 小号合并策略 **Backlog**）。 |
| P2 | `external_userid`（企微外部联系人） | 国内企微主路径；与 `customer` 表已有列对齐。 |
| P3 | `link_id`（或等价 `click_id` / `fbclid` 规范化后的稳定字符串） | 广告点击侧可传递；**须规范化**（长度截断、仅允许 `[a-zA-Z0-9_-:]` 等，实现期定稿）。 |
| P4 | `first_touch_utm` | 首次触达 UTM 快照（JSON 或扁平键 `utm_source` 等）；**不覆盖**后续 UTM，仅存「首触」。 |
| P5 | `region_pack_id` | 与 `message-service` RegionPack id（如 `th-bangkok`）对齐，用于策略与报表分区。 |

**冲突规则（v0.1）**：

- 同一 `corp_id` 下，若 `customer.id` 已存在，新事件携带的 `link_id` / UTM **合并写入** `customer` 侧归因 JSON（见实现计划 Task 7），**不降级**已有 `customer.id` 关联。
- **多设备 / 多 IM**：若仅有 `link_id` 而无 `customer.id`，事件进入 **待解析队列**（占位：可用独立表或 `channel_scan_touch` 仅追加）；不在本文档编造解析算法。

---

## 2. 字段对齐表（写入侧）

| 语义 | 建议 JSON 键名 | 写入载体（现状） | 备注 |
|------|----------------|------------------|------|
| 活动/计划 | `utm_campaign` | `message_log.extra`；活码扫码 ingest body | 与 Sprint 9 `extra` 约定一致 |
| 创意 | `creative_id` | 同上；ingest-scan body | 字符串或小整数字符串 |
| 区域包 | `region_pack_id` | 同上；ingest-scan body | 须为已发布 RegionPack `id` |
| 首触 UTM 快照 | `first_touch_utm` | 客户侧归因 JSON（实现期列或 JSONB） | 仅首写 |
| 企微外部 ID | `external_userid` | `customer.external_userid` | 已存在 |
| 幂等键 | `external_event_id` | 已有 `ingest-scan` 的 `externalEventId` | 与 Redis 去重键一致 |

---

## 3. 与 `message_log.extra` 的关系

发送 API 已支持 `extra` 任意 JSON；运营 / 编排层应在 **营销类** 发送中尽量带齐 `utm_*`、`region_pack_id`，便于与 `channel_scan_touch`（或等价表）做离线关联。

---

## 4. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | v0.1 初稿 |
