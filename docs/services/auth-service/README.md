# Auth Service — 认证与本企业员工目录

更新：2026-10-26。默认服务端口7001；运行时为Midway.js 3 / Koa、TypeORM / PostgreSQL16、Redis、bcrypt和JWT。本文描述当前源码，早期注册、SSO、完整权限中心设计不作为已实现能力。

## 登录与企业上下文

`POST /api/v1/auth/login` 接受：

```json
{"username":"operator","password":"用户密码","corpId":1001}
```

`corpId` 可省略，提供时必须是JSON数字形式的正安全整数；字符串、null、数组、小数及超范围数值均400。指定企业时只查询该企业和用户名，不在密码错误或企业不存在时回退到其他企业。未指定时只兼容全库唯一用户名；同名账号属于多个企业时400并提示填写企业编号，不返回候选企业或尝试随机账号。

未知账号、错误密码、停用账号统一401及“账号或密码错误”。登录/刷新路由的DTO校验明确使用400，不再沿用Midway默认422。参数、歧义、账号或密码失败不会签发凭证或更新最后登录时间；成功返回顶层 `accessToken`、`refreshToken` 和 `user:{id,username,corpId,isAdmin}`，并更新最后登录时间。PostgreSQL bigint通常以字符串返回，不应先转换为浮点数再保存身份。

企业编号必须由用户已有渠道取得；没有新增公开企业目录或自动猜测企业。客户端 `x-corp-id`、`x-user-id` 和query参数不能替代登录正文的企业编号。

## 刷新与访问令牌的区别

`POST /api/v1/auth/refresh-token` 接受 `{"refreshToken":"..."}`，成功只返回新的 `accessToken`。网关在**精确刷新路径**不要求有效access：无Bearer或携带过期access时，仍可凭合法refresh续期。认证服务独立验证refresh签名、有效期、`type=refresh`、用户ID及当前用户启用状态；无效、过期、access冒充refresh、用户缺失或停用均401，非法DTO为400。

访问令牌包含企业、用户、用户名、管理员标志及角色代码；当前默认有效期2小时，refresh为7天。网关保护资源只接受用途未声明的兼容access或 `type=access`，并验证身份格式。refresh不能作为Bearer访问员工目录，即使签名有效。

`POST /api/v1/auth/verify-token` 和 `/logout` 已有控制器入口，经过网关仍要求access。logout的现有行为是客户端清理凭证，没有服务端撤销列表。当前没有refresh轮换、持久会话撤销或SSO交付；提供刷新API不等于两个前端均已实现自动续期。

## 本企业员工目录

`GET /api/v1/staff` 供普通已登录员工查询本企业启用同事，与管理员全局 `/api/v1/users` 分开。返回：

```json
{"success":true,"data":{"list":[{"id":"123","username":"operator","realName":null}],"total":1,"page":1,"pageSize":20}}
```

每行只含精确十进制字符串 `id`、`username`、可空 `realName`。不返回密码、角色、手机、邮箱或企业等附加信息；筛选条件包含认证企业及 `status=1`，稳定按username、id排序。

查询只接受 `page`（默认1）、`pageSize`（默认20，上限100）、`keyword`（最多50字符）。关键词按用户名或真实姓名作大小写不敏感字面子串查询，`%`、`_`、反斜线转义后绑定SQL参数。未知参数（含corpId/status）、数组、歧义数字和不安全分页偏移均400。缺少完整有效身份401。

目录保留大bigint字符串，但使用数字DTO的调用方仍需拒绝不能安全转换的ID。目录查询不替代客户分配/站内通知保存时的权威员工归属与启用校验。

## 用户管理与部署边界

当前控制器为auth、staff、user、health；用户及角色实体已有关系，但没有独立的注册、SSO或完整权限管理控制器。`/api/v1/users/*` 的全局用户管理语义保留，网关要求严格管理员身份；不应拿该接口作为普通运营人员选择器。

staff从可信网关头或服务已认证的 `ctx.state.user` 解析身份。头本身不是签名凭证；业务端口依赖可信内部网络边界。网关JWT签名检查与接口企业过滤是不同层次，不代表全部用户管理入口已完成安全审计。

## 验证证据

- [真实企业登录与刷新](../../tests/2026-10-26-tenant-login-real-http-ui.md)：PostgreSQL16.13、实际auth/gateway与Vite；4项HTTP、1项真实运营登录浏览器，共5项通过。包含两企业同名不同密码、唯一用户名兼容、非法DTO400、独立刷新及refresh-as-Bearer拒绝。过期/停用refresh明确使用本次测试密钥构造的受控夹具。
- [员工目录与通知真实HTTP](../../tests/2026-10-26-staff-real-http.md)：双企业普通员工实际登录，4项HTTP通过；企业过滤、精确bigint、字段白名单、搜索/分页/伪造头、通知整批归属均有数据库证据。
- 上述脚本只用一次性数据库和随机loopback端口，并核验清理。它们不是远程CI、真实生产部署、SSO或全部认证攻击面的证明。

复现入口（仓库根）：

```bash
node code/scripts/test/overnight-tenant-login.cjs
node code/scripts/test/overnight-staff-http.cjs
```

脚本共享服务dist，运行真实链路时应串行构建，避免并发clean互相删除产物。

## 本地开发

在 `code/services/auth-service` 使用 `pnpm dev`、`pnpm type-check`、`pnpm test`、`pnpm build`。数据库配置为 `DB_HOST`、`DB_PORT`、`DB_USERNAME` / `DB_USER`、`DB_PASSWORD`、`DB_DATABASE`；Redis使用 `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`。auth与gateway须采用同一 `JWT_SECRET`，cookie签名使用 `APP_KEYS`。源码配置与完整建库说明见[事实索引](../../../code/docs/代码现状与文档索引.md)。测试没有自动迁移或修改项目已有数据库。
