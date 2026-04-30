# 网关路由事实表（与代码同步）

**事实源**：`code/services/gateway-service/src/config/config.default.ts` 中 `gateway.routes`。  
代理规则：`targetUrl = route.target + 原始请求 path`（路径不重写）。

| 路径前缀 | 默认上游（环境变量可覆盖） | 默认端口（本机 `mw dev`） |
|-----------|---------------------------|---------------------------|
| `/api/v1/auth/*` | `AUTH_SERVICE_URL` | 7001 |
| `/api/v1/users/*` | `AUTH_SERVICE_URL` | 7001 |
| `/api/v1/customers/*` | `CUSTOMER_SERVICE_URL` | 7002 |
| `/api/v1/tags/*` | `CUSTOMER_SERVICE_URL` | 7002 |
| `/api/v1/follow-ups`、`/api/v1/follow-ups/*` | `CUSTOMER_SERVICE_URL` | 7002 |
| `/api/v1/tags` | `CUSTOMER_SERVICE_URL` | 7002 |
| `/api/v1/acquisition/*` | `ACQUISITION_SERVICE_URL` | 7003 |
| `/api/channel-code`、`/api/channel-code/*` | `ACQUISITION_SERVICE_URL` | 7003 |
| `/api/platform-account`、`/api/platform-account/*` | `ACQUISITION_SERVICE_URL` | 7003 |
| `/api/v1/operation/*` | `OPERATION_SERVICE_URL` | 7004 |
| `/api/sop/*` | `OPERATION_SERVICE_URL` | 7004 |
| `/api/mass-task/*` | `OPERATION_SERVICE_URL` | 7004 |
| `/api/v1/assets/*` | `ASSET_SERVICE_URL` | 7005 |
| `/api/v1/analytics/*` | `ANALYTICS_SERVICE_URL` | 7006 |
| `/api/v1/integration/*` | `INTEGRATION_SERVICE_URL` | 7007 |
| `/api/v1/messages/*` | `MESSAGE_SERVICE_URL` | 7008 |
| `/api/message`、`/api/message/*`（两条路由） | `MESSAGE_SERVICE_URL` | 7008 |
| `/api/notification`、`/api/notification/*`（两条路由） | `MESSAGE_SERVICE_URL` | 7008 |
| `/api/v1/finance/*` | `FINANCE_SERVICE_URL` | 7009 |

**不在此表**：网关自身 `GET /health` 等由 `gateway-service` 直接处理。

**Sprint 9 推导路径（analytics）**：`GET /api/v1/analytics/funnel-gap-placeholder` → `ANALYTICS_SERVICE_URL`（OLTP 聚合，见 [funnel-metrics-v0.1.md](./funnel-metrics-v0.1.md)）。  
**Sprint 9+ 推导路径（operation，mock）**：`GET|POST /api/v1/operation/cod-mock/state` → `OPERATION_SERVICE_URL`（内存 COD 状态占位）。

**维护约定**：新增 `/api` 前缀路由时，须同时更新本表与（如适用）[迭代计划-E2E.md](../迭代计划-E2E.md) 端口说明。
