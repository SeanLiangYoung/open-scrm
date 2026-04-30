# Sprint 8 — 本地启动与验证（一页纸）

对应 [迭代计划-E2E.md §2.5.2](../迭代计划-E2E.md#next-sprints-s7-s8) 与 [Sprint3-功能开发测试计划](./Sprint3-功能开发测试计划.md)（`consentPurpose` / `messageType` 扩展）。

## 依赖

- **gateway、auth-service、message-service** 已启动；PostgreSQL 使用 **`code/scripts/init-db.pg.sql`** 初始化过的 `scrm_dev`（含表 **`consent_record`**）。
- 种子：**客户 `id=1`** 有一条未撤回的 **`marketing`** 同意；**客户 `id=2`** 默认无营销同意（用于 E2E 403）。

旧数据卷若无 `consent_record`：对开发库执行当前仓库中的建表 + 种子 SQL 片段，或重建 Postgres 卷后重新 init。

## API 契约（摘要）

| 场景 | 预期 |
|------|------|
| `consentPurpose: 'marketing'` + `targetType: 1` + 无同意客户 | **403**，`success: false` |
| `consentPurpose: 'marketing'` + `targetType: 1` + 客户 1 + `messageType: 5` | **200**，写入 `message_log` 且发送成功（Mock，无外部 BSP） |
| `consentPurpose: 'marketing'` + `targetType` ≠ 1 | **400** |

`messageType: 5`：**Outbound Mock**（`doSendMessage` 无外部调用），与 Sprint 3 的 `messageType: 2` 类似，用于闸门与编排联调。

## E2E

在 **`code/`** 目录，网关可访问时：

```bash
pnpm test:e2e:sprint8
```

等价：`bash ./e2e/run-sprint8-api.sh`（默认 `GATEWAY_URL=http://127.0.0.1:17000`）。

## Backlog（未在本切片实现）

- **撤回后营销再发失败**：需同意撤回写入 API 或 SQL 后再加一条 Playwright。
- **`regionPackId` 请求字段**：当前 RegionPack 以 **`message-service` 内静态目录** `src/catalog/region-packs.ts` 可读；发送 API 尚未强制校验 `regionPackId`（见迭代主文档 S8 工作项说明）。
