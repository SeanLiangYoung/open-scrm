# message_template.extra — 双语与督导字段约定

> 与 [东南亚增长+归因实现计划](../plans/2026-04-28-sea-growth-attribution-implementation-plan.md) Task 5 对齐。

## 推荐 JSON 形状（示例）

```json
{
  "customerLocale": "th-TH",
  "supervisorSummaryZh": "高意向-促销A",
  "tabooPackId": "th-bangkok"
}
```

| 字段 | 说明 |
|------|------|
| `customerLocale` | BCP 47 语言标签，顾客侧渲染用 |
| `supervisorSummaryZh` | 督导/质检侧中文摘要，不落顾客侧文案 |
| `tabooPackId` | 与 RegionPack / 禁忌词分区 id 对齐 |

后端 **已实现（可选校验）**：`message-service` 内 `validateMessageTemplateExtra`（`create` / `update` 模板时若带 `extra` 则校验约定键）；非法时抛错，由控制器层转为 HTTP 4xx（与现有模板 API 错误处理一致）。

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-28 | 初稿 |
