# 归因事件 Taxonomy（v0.1，≤12）

> **状态**：命名与必选属性契约；**daily_stat 对齐**列标明 Phase。

| 事件名 | 必选属性 | 写入方（建议） | daily_stat 对齐 |
|--------|----------|----------------|-----------------|
| `ad.click` | `link_id` 或 `utm_campaign`、`corp_id` | 广告落地 SDK / 网关占位 | Phase C+ |
| `landing.view` | `page_id` 或 URL、`corp_id` | 落地页 / 网关 | Phase C+ |
| `channel.scan` | `channel_code_id`、`corp_id` | `acquisition-service` ingest-scan | Phase C+（可先仅 DB） |
| `im.add_friend` | `external_userid` 或 `customer_id`、`corp_id` | integration / customer | Phase C+ |
| `im.first_reply` | `conversation_id` 或 `customer_id`、`corp_id` | message / 会话服务 | Phase C+ |
| `message.send` | `message_log_id`、`message_type`、`corp_id` | `message-service` | 已有 message_log |
| `message.policy_block` | `reason_code`、`region_pack_id` | `message-service` 策略闸门 | Phase C+ |
| `order.placeholder` | `order_ref`、`corp_id` | OMS / 手工导入 | Phase C+ |
| `cod.intent` | `customer_id`、`corp_id` | 运营录入 / 未来工单 | Phase C+ |
| `cod.payment_proof` | `customer_id`、`proof_ref` | 同上 | Phase C+ |
| `cod.shipped` | `customer_id` | 同上 | Phase C+ |
| `cod.delivered` | `customer_id` | 同上 | Phase C+ |

**说明**：`channel.scan` 与现有 `ingest-scan` 语义对齐；新增属性通过 body `extra` 或平铺字段承载，以 **实现计划 Task 7** 为准。

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | v0.1 初稿 |
