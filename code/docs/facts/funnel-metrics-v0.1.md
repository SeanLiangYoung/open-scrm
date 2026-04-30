# 漏斗与归因缺口指标（v0.1）

> 与 `GET /api/v1/analytics/funnel-gap-placeholder` 占位实现及 `computeAttributionGapMetrics` 对齐。

## 定义

| 指标 | 分子 | 分母 |
|------|------|------|
| **messageAttributionGapRate** | 无「触达线索」关联的发送条数（占位：总发送 − 带 touch hint） | 总发送条数 |
| **customerUnlinkedRate** | 无归因 JSON 的客户数（占位：总客户 − 已挂归因字段） | 总客户数 |

占位 API 使用 **固定示例输入**；真实值应由 `message_log`、`channel_scan_touch`、`customer` 等表聚合（Phase C+）。

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | 初稿 |
