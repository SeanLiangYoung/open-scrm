# 身份链与前端登录竞态交叉审查

审查当前工作树，范围为gateway认证/代理中间件、auth登录/刷新服务与DTO、两端Login、Pinia认证store和Axios拦截器。只读阶段没有构建、真实HTTP、数据库或第三方调用。

## 重要：旧请求401会清除新登录身份

定位：[管理端API拦截器](../../code/apps/admin-platform/src/utils/api.ts)、[运营端API拦截器](../../code/apps/operation-platform/src/utils/api.ts)。审查时分别为31–33和26–28行：除登录请求外，任何401都会无条件移除当前token并跳转，未比较失败请求携带的凭据和当前登录身份。

实际重现使用当前TS源码内存转译、真实Axios与真实Pinia/Vue，替身Axios adapter控制响应，无网络、无页面内部探针：

1. token=old-A时发出客户列表请求，实际请求头为 `Bearer old-A`，暂不返回。
2. logout后成功登录企业B，store和localStorage token均为new-B。
3. 第1步旧请求返回401。
4. 两端均将localStorage token删除并跳转/login，而store仍为new-B；管理端user及refreshToken仍保留。

两端实际输出均为：`beforeLate401=new-B, afterLate401=null, storeToken=new-B, redirect=/login`。这是可触发的会话丢失，store的最新登录尝试保护无法覆盖API拦截器的独立副作用。需要绑定请求发出时的凭据/会话代次，只有仍属于当前会话的401才能清理。

## 其他边界检查与限制

- 网关25认证单测与3代理单测通过：refresh用途不能访问保护路径；身份必须为规范正安全整数；非真实管理员claim不能放行用户管理；代理根据验证后的state写身份头，不透传伪造身份头。
- auth服务34登录/刷新单测及14控制器单测通过：指定企业只查询该企业，不回退其他企业；同名无企业号拒绝；密码/禁用失败不签名或更新登录时间；刷新先验证签名及用途，再查询当前启用用户并重建权限。DTO企业号严格安全整数。
- 现有真实Pinia/Vue状态检查10项通过：较新登录响应优先、退出使在途登录失效、过期成功/失败返回false；页面在validate前设置loading并禁用输入。该检查原先只替身API，因而没有覆盖本次发现的Axios401副作用。
- 本轮单测的JWT和仓库是替身，不宣称实际签名/HTTP/数据库验证。安全整数上限外的数据库身份被网关拒绝，未观察到向其他企业舍入授权，不将其描述为跨企业漏洞。
- 当前刷新凭据没有服务端注销撤销机制，属于已有客户端删除Token契约；本轮未扩展会话基础设施。

复验命令：在gateway-service执行 `vitest run src/middleware/auth.middleware.spec.ts src/middleware/proxy.middleware.spec.ts`（28通过）；在auth-service执行 `vitest run src/service/auth.service.login.spec.ts src/controller/auth.controller.login.spec.ts`（48通过）；根目录执行 `node code/e2e/check-login-store-races.cjs`（10通过）。迟到401复现随后转为持久回归，修复证据补记于下。

## 修复与回归（同轮完成）

新增持久检查：[check-auth-response-races.cjs](../../code/e2e/check-auth-response-races.cjs)。使用当前两端API/store源码、真实Axios/Pinia/Vue，只替换Axios adapter，不发送网络请求。

首轮红测14项中6失败、8通过：两个端各自的旧企业401、退出重登相同token后的旧401、匿名旧401覆盖新登录均失败。修复为请求发出时记录token和会话代次，只有仍匹配当前token及代次的保护请求401才能触发原有退出行为。成功登录推进会话代次，因此同一秒重登获得相同JWT也能区分旧请求。

进一步新增“旧登录成功响应不能使获胜会话的当前401失效”检查，初始修复下两端各1失败（14通过、2失败）。补充只允许最新登录请求的成功响应推进代次后，最终 **16通过、0失败**。没有为较旧登录响应推进新会话，也没有因失败登录压制当前会话正常401。

最终每端8项行为：旧企业401、相同token退出重登、旧登录成功响应、当前保护401、当前匿名401、匿名旧401遇新登录、登录401原地反馈、失败登录后当前保护401仍退出。既有store并发检查另 **10通过、0失败**。两端针对API文件ESLint和 `vue-tsc --noEmit` 通过；没有执行clean构建、真实HTTP或真实数据库。

当前会话401继续遵循原有清token并跳转页面的契约；用户/refreshToken的清理范围没有扩大。该修复防止旧响应误伤新会话，不新增自动刷新或服务端会话撤销。红绿日志保留于 `/tmp/auth-response-red.log`、`/tmp/auth-response-stale-login-red.log`、`/tmp/auth-response-green.log`。
