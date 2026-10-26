# 全局用户管理员写边界只读审查（2026-10-26）

审查范围：auth UserController本地Create/Update DTO及全部用户入口、UserService、PasswordUtil/登录空密码检查、User/Role实体、gateway auth/proxy及对应事实文档。源码冻结期间仅添加独立探针和本文档，未改生产源码、注册测试，未build/HTTP/数据库，也未外部通信。后续根任务已单独授权修复下述三项；修复结果另见后续报告。

## 权限事实与排除

`/api/v1/users/*`是管理员**全局**用户管理；gateway要求验证后的isAdmin===true或===1，普通员工应使用本企业staff目录。用户服务不按登录企业过滤全局用户，不构成这项契约下的跨企业越权。RoleEntity有corpId，但现有事实未定义管理员全局角色分配必须同企业；不能仅据缺corp过滤就宣称已证实角色越权。这里不实施新RBAC政策。

实际DTO是类，CreateUserDto/UpdateUserDto没有Partial类型擦除。独立getSchema探针确认Update拒绝id/corpId/isAdmin/password/roles注入，Create拒绝伪造id；因此UserService.create的对象spread不应被误报为当前HTTP可达的主键/管理员注入。未知属性被正常DTO边界拒绝，不把仅内部强转绕过DTO当对外漏洞。

## 三项确认问题

1. **重置密码缺验证，能保存登录拒绝的空密码。** `UserController.resetPassword`无Validate/DTO，只取newPassword。当前真实PasswordUtil使用bcrypt可以hash空串，UserService随后update成功；实际AuthService.login在查询前拒绝空串400，账户因此被重置为正常登录不能提交的凭据。单字符x也可重置，弱于CreateUserDto既有min8。建议ResetPasswordDto显式字符串min8，并在服务方法直接调用时同样先拒绝，不擅自把未全局启用的强密码正则说成既有策略。
2. **用户路径Number宽松转换。** get/update/delete/reset/assign均Number(id)，没有canonical/safe整数检查。探针真实controller→service方法将'2e0'转换成2并更新user2；实体主键BIGINT，超过JS安全范围的路径还有舍入选错记录风险。建议原始路径保持string，拒非规范/超safe整数，再转number；不能将用户BIGINT缩到角色INT32。
3. **角色请求集合不完整却成功替换。** assignRoles对roleIds无DTO，findByIds只返回存在角色，随后直接替换user.roles。探针请求[3,999]只得到存在3，却成功覆盖原角色集合，999缺失没有错误。建议显式角色数组DTO、JSON正整数INT32（Role.id实际int），去重并完整匹配存在集合，任一缺失在save前拒绝；显式[]可清空，不应把未提供roleIds误当清空。保留合法全局分配，不以此新增企业策略。

## 可复现证据与实际审过入口

探针 `node code/scripts/test/probes/admin-write-boundary-review.cjs`，本轮exit0，输出 `/tmp/admin-write-boundary-review-evidence.json`。当前TS在内存transpile，运行实际controller/service/getSchema；repository/JWT为内存适配器，PasswordUtil使用真实bcrypt（fixture rounds4）。不加载运行配置或Bootstrap、不访问实际DB/HTTP。它断言旧缺陷存在，修复后不能把该旧探针当绿色验收。

- POST users：实际schema检查不可变字段与create min8；返回层显式去password。没有证明可经正常HTTP注入主键。
- PUT users/:id：实际Update schema白名单及科学计数路径改写。
- GET users、GET users/:id：读取用户与roles；实体password配置select:false，普通find没有addSelect密码，未观察到当前SQL默认选择密码的代码证据。未用故意返回密码的stub冒充真实ORM泄露。
- DELETE users/:id：沿用宽松Number路径；已有禁止删除isAdmin===1用户逻辑，不把管理员本身获准删除普通用户说成漏洞。
- POST reset-password：真实bcrypt空串及单字符持久化，实际AuthService空串400。
- POST users/:id/roles：完整集合缺口，未将全局跨企角色操作误报。
- gateway GET/写子路径 `/users/`、`/users/2`、`/users/2/reset-password`、`/users/2/roles`：实际middleware方法验证false和字符串'1'均403，数字1/boolean true授权；伪造x-is-admin不改变JWT判定。Proxy源读取身份只用state并不透传客户端身份头。未发现本轮可证明的admin路由绕过。

这不是SSO、完整RBAC、签名密钥治理、会话撤销、用户管理并发事务或全部个人信息审计；没有运行真实HTTP/PG来证明路径解析或存储错误码。三项证据仅限实际schema和方法适配器重现，不宣称生产漏洞被远程利用。

## 后续已授权修复

根任务授权后，三项已按上述边界实施；新增87项测试、auth全157项/tsc及独立PG9检查通过，生产冻结。详见[M27验证报告](2026-10-26-admin-write-validation.md)。本页探针断言旧缺陷存在，修复后不作为绿色验收入口；保留作冻结期间历史审查证据。
