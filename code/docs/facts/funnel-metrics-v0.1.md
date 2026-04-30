# 漏斗与归因缺口指标（v0.1）

> 与 `GET /api/v1/analytics/funnel-gap-placeholder`（OLTP v0.2）及 `computeAttributionGapMetrics` 对齐。

## 定义

| 指标 | 分子 | 分母 |
|------|------|------|
| **messageAttributionGapRate** | 无「触达线索」关联的发送条数（占位：总发送 − 带 touch hint） | 总发送条数 |
| **customerUnlinkedRate** | 无「窗口内带 hint 成功触达」的客户（v0.2：**总客户数 − 窗口内至少收到一条带归因 extra 的成功发送的去重客户 id**） | 总客户数（`customer` 表按 `corp_id`） |

**OLTP v0.2（已实现）**：`FunnelGapQueryService` 单条 SQL 聚合 `message_log`（`send_status=1`、时间窗内 `extra` 含 `utm_*` / `region_pack_id` / `link_id` 等键即计为 hint）、`customer` 全量、`channel_scan_touch` 行数（辅助指标 `channelScanTouchCount`）。默认 **近 31 天 UTC**；可选 `?startDate=&endDate=`（须成对，`YYYY-MM-DD`，窗口 ≤93 天）。`customer` 表尚无 `extra` 归因列时，本定义用 **触达侧** 代理，避免伪精确；后续有客户级 JSON 时再收紧口径。

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | 初稿 |
| 2026-04-28 | v0.2：占位 API 改为 OLTP 聚合；客户率定义改为触达侧代理 |
