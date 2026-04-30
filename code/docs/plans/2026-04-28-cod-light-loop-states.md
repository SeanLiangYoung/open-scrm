# COD / 本地支付轻闭环 — 状态与 API 草图（占位）

> **状态**：仅文档；实现见后续独立计划。与 B 主线「离钱近」一致。

## 状态枚举

| 状态 | 说明 |
|------|------|
| `intent` | 顾客表达下单意向 |
| `awaiting_payment_proof` | 待支付凭证（转账截图 / PromptPay 等） |
| `shipped` | 已发货 |
| `delivered` | 已签收（或 COD 完成） |

## 与频控关系

`messageCategory: 'cod_reminder'` 类触达应在 RegionPack 策略上 **单独更严**（实现期：`evaluateOutboundSendPolicy` 扩展或并行策略键）。

## API 草图（未定稿）

- `POST /api/v1/.../cod-intents` — 创建 intent  
- `PATCH .../cod-intents/:id` — 状态迁移  

路径归属 `operation-service` 或 `customer-service` 待评审。

## Mock（占位已实现）

- `GET /api/v1/operation/cod-mock/state` — 读当前内存状态（默认 `intent`）  
- `POST /api/v1/operation/cod-mock/state`，body `{ "state": "shipped" }` — 写内存状态（进程重启丢失）

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | 初稿 |
