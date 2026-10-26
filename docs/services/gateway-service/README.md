# Gateway Service — 网关身份与代理契约

更新：2026-10-26。默认本地端口7000；Docker Compose入口为宿主17000→容器7000。当前是Midway.js 3 / Koa、JWT、Redis计数限流与HTTP代理，不把早期熔断、完整权限中心、负载均衡或防护设计当作已交付功能。

## 请求处理与身份

中间件按Redis限流、认证、代理顺序运行。受保护请求必须携带 `Authorization: Bearer <accessToken>`。验证签名及有效期后，`userId`、`corpId` 必须为规范十进制正安全整数，可由数字或规范字符串表示；缺失、歧义或超出范围401。

用途仅接受未声明 `type` 的兼容access或显式 `type=access`；refresh、reset等用途不能成为访问身份。角色代码存在并不自动授予管理员。当前只有布尔 `true` 或数字 `1` 的 `isAdmin` 被认可，随后上下文规范化为布尔值；字符串 `"true"` / `"false"`、数字2、数组和对象等truthy值不授予管理员权限。

`/api/v1/users` 前缀要求管理员，不满足时403；普通员工可访问 `GET /api/v1/staff`，由auth按当前企业和启用状态过滤。不是所有路由都已实现完整RBAC权限检查。

代理的 `x-corp-id` / `x-user-id` / `x-username` / `x-is-admin` 只从验证后的 `ctx.state.user` 生成，不透传客户端伪造身份头。业务服务仍须作为可信内部端口部署；原始头不是可独立验证的认证凭证。

## 登录与独立刷新

登录由auth处理 `POST /api/v1/auth/login`。可选JSON数字 `corpId` 决定企业范围；未提供时只兼容全库唯一用户名，同名多企业返回400。网关不会把客户端身份头或querycorpId转换成登录企业正文。

**精确** `/api/v1/auth/refresh-token` 路径跳过access前置校验，避免access过期后不能续期。认证服务仍必须验证正文refreshToken签名、有效期、refresh用途和当前用户启用状态；合法请求可不带Bearer，也不被过期access阻断。`/refresh-token/extra`没有因此开放；有效refresh用作员工目录Bearer仍401。

既有白名单还包含登录/注册前缀、健康/指标探测、`/api/v1/integration/health`及企微回调 `/api/v1/integration/wework/callback`。除精确刷新外，这些既有条目使用前缀匹配。白名单中保留注册路径不代表auth已实现注册；不要从网关配置推导不存在的业务能力。

## 代理与错误语义

当前路由事实源为 `code/services/gateway-service/src/config/config.default.ts`。认证、用户、员工目录路由到auth；客户/标签/跟进路由到customer；SOP/群发路由到operation；消息、通知、分析、集成、素材、获客和创作中心按各服务URL配置转发。财务路由配置不等于财务业务已验证。

代理保留Authorization、Content-Type和Idempotency-Key；企微 `text/xml` / `application/xml` 按原文解析后转发。业务状态和响应正文保留；目标连接拒绝返回503，其余代理错误502。普通代理超时30秒，内容工坊重请求为120秒。没有新增自动发送重试的保证。

限流按IP和路径在Redis计数，超限429并返回剩余额度头；Redis异常时当前实现放行。它不是熔断、跨实例负载均衡、全路径权限或生产防滥用审计的证明。

## 已验证的实际链路

- [企业登录/刷新5项](../../tests/2026-10-26-tenant-login-real-http-ui.md)：实际auth/gateway、PostgreSQL16.13和真实运营登录页；同名企业范围、错误状态400/401、无Bearer与过期access刷新、refresh-as-Bearer拒绝及精确刷新路径都有证据。
- [员工目录/通知4项](../../tests/2026-10-26-staff-real-http.md)：两个普通员工登录、企业过滤、公开字段、伪造头无效；站内通知只有正确归属的去重目标写入。
- [客户真实浏览器3项](../../tests/2026-10-26-customer-real-ui.md)：Vite→网关→真实auth/customer→PG16，包含新建客户、跟进保存/刷新、真实失败保留草稿及实际员工选择后分配。
- [跟进多企业真实HTTP](../../tests/2026-10-26-customer-http.md)、[分析实际HTTP11项](../../tests/2026-10-26-analytics-http.md)分别保留各自夹具、时间窗口和断言，不能混为一轮生产验收。

严格admin标志与访问用途另有网关单元回归；上述真实登录使用正常签发的非管理员JWT，不宣称已在生产枚举全部畸形签名凭证。隔离脚本核验自建资源清理，没有修改已有数据库、真实外发消息、部署或远程CI结果。

## 开发与配置

在 `code/services/gateway-service` 使用 `pnpm dev`、`pnpm type-check`、`pnpm test`、`pnpm build`。依赖Redis；auth与gateway必须共享 `JWT_SECRET`。`APP_KEYS`用于cookie签名，服务目标使用相应 `*_SERVICE_URL`，完整变量与端口以源码和[仓库事实索引](../../../code/docs/代码现状与文档索引.md)为准。真实HTTP脚本会clean共享dist，需协调串行运行。
