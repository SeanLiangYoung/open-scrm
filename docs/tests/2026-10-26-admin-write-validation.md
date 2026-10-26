# M27 全局管理员用户写入校验与PG关系一致性（2026-10-26）

根任务授权修复[管理员写边界审查](2026-10-26-admin-write-boundary-review.md)确认的三项。仅修改auth UserController/UserService、新纯校验helper及对应测试；未改共享gateway/runner、未build或启动HTTP、未接触现有用户DB、未提交。生产源码已明确冻结交由根任务全50回归。

## 实现与保留契约

- ResetPasswordDto显式接收newPassword，字符串至少8位，与既有创建用户最低长度一致，未知字段拒绝；服务直接调用也在查询/hash/写前验证。没有给登录添加新长度门槛，没有擅自启用此前未全局使用的强密码正则。合法密码按原值hash，不trim或改写。
- get/update/delete/reset/assign五类用户路径保持原始string，先验证规范十进制正安全整数，再转number；科学/十六进制/前导零/小数/空白/越界拒绝400。用户主键仍BIGINT，safeMAX合法，不按角色INT32错误缩小。服务方法也验证ID，避免绕过controller的内部误用。
- AssignRolesDto为必填JSON正整数INT32数组，Role.id实际SERIAL；明确[]表示清空，缺字段/字符串等不等同清空。服务去重且完整验证所有角色存在，缺任一在保存之前整体400，旧集合保持。
- 分配/清空通过同callback manager事务：先锁用户行FOR UPDATE（不对nullable roles join加锁），所选角色按id排序FOR SHARE，持锁完成全部关系保存和响应读取。并发同用户替换串行，关系保存错误完整回滚。
- **全局管理员语义保留**：没有新增corp过滤；管理员可为目标用户分配其他企业已存在角色。没有把当前全局授权误报或修成staff目录语义。gateway严格admin判定未修改，信任的内部端口部署要求仍适用。

Create/Update原DTO类保持字段白名单；没有Partial擦除或新增主键/isAdmin/password/roles注入。DTO类为测试可导出，但公开JSON字段没有因此扩展。Role结果默认不选User.password，实际PG返回序列化检查不含password。

## 单元红→绿与类型检查

新增 `controller/user-write-boundary.spec.ts` 70项与 `service/user-write-boundary.spec.ts` 17项，首次 **75失败/12通过**。覆盖五条用户路径非法及BIGINT-safe合法边界、reset schema/直接服务非法密码、角色数组类型和INT32边界、缺角色不替换、合法全局跨企/去重、显式清空、事务关系失败回滚与锁设置。

修复后新增 **87/87通过**；全auth **6文件157项通过，0跳过**，`tsc --noEmit` exit0。运行命令：

```bash
cd code/services/auth-service
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
```

日志 `/tmp/admin-user-write-red.log`、`/tmp/admin-user-write-green.log`、`/tmp/admin-user-write-all-unit.log`。原有登录/refresh/staff/密码工具70项继续通过，没有修改它们来降低期望。

## 当前源码 + 实际PostgreSQL16（9项）

入口：`node code/scripts/test/overnight-admin-user-postgres.cjs`。创建自有随机loopback PG16容器，独立admin_user_pg数据库/账号；当前TS仅在内存编译，真实TypeORM读取User/Role实体，无dist/Bootstrap/Redis/HTTP。容器先create登记再start，TCP就绪后仅初始化自有库，最终移除并核验不存在；清理失败整体非零。

结果：**9检查通过、exit0**，artifact `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-admin-user-pg-8r1BSL`。result.testsPassed/cleanup.passed/passed均true，errors为空；PG随机端口50053（以result.json为准，若本地工件清理不得据本行猜新运行端口）。

1. PostgreSQL主版本16。
2. 请求存在16302+缺失19999，整体400，原角色16301不变。
3. 目标用户corp101，合法其他企业corp202角色16302去重分配成功；实际返回不序列化password，保留全局管理员语义。
4. []显式清空；角色INT32_MAX=2147483647存在时合法分配，不任意缩小有效范围。
5. user_role受控CHECK对16303插入失败23514，完整原集合16301恢复。
6. 两组并发完整替换[16301,16302]与[16302,16303]，最后恰为其中一整组，无混合/部分集合。
7. 另一事务先DELETE role16303未提交；实际assign SELECT FOR SHARE被阻塞。通过pg_stat_activity/pg_blocking_pids观测真实锁等待后提交删除，分配400、原角色16301保持。没有靠固定延时猜测并发顺序。
8. 空密码拒绝且原hash不变；合法Test@123实际写入bcrypt hash并由真实PasswordUtil验证成功（fixture saltRounds4，不输出hash）。
9. canonical用户safeMAX路径精确读到同号BIGINT用户；超safe路径拒绝400。

最终角色集合为16301，database-evidence.json保留SQL关系与锁等待结论，result.json保留检查列表和资源清理。自检没有调用外部服务或发送消息；检查数包含版本和边界，并非9个实际HTTP请求。

## 边界与未做事项

本批没有真实HTTP路由/Validate中间件新场景；schema、controller/service和实际PG分层验证，root统一现有auth/gateway回归另行记录。未做完整SSO/RBAC、会话撤销、全局用户管理所有字段存储上限或用户删除依赖审计。

初始化SQL的user_role未声明外键，本事务/锁保证本次分配期间的集合验证和完整保存，不声称任意**提交后**直接SQL删除角色仍自动清理孤立关系；本批不新增共享schema约束或新的角色删除API。该限制与当前没有独立角色管理控制器的事实分开记录，不能据此把合法全局角色操作定义为跨企漏洞。

## 统一回归发现的格式门禁与修复

根任务首次全50的workspace lint实际失败，auth为37条prettier错误，另有27条warning；因此前述unit/type/PG绿色不能替代lint通过。先仅格式化本批3个生产源（user.controller.ts、user.service.ts、admin-user-validation.ts），生产源错误清零后，全auth剩余27条prettier错误位于本批2个新增user-write-boundary.spec.ts。继续只格式化这2个自有新增spec，没有触碰他人既有文件、关闭规则或压制warning。

最终 `eslint . --ext .ts` **exit0，0 errors / 27 warnings**；日志 `/tmp/admin-user-auth-lint-green.log`。格式后重新全auth **6文件157项通过、tsc --noEmit及diff-check exit0**，日志 `/tmp/admin-user-auth-final-unit.log`。27条既有/测试any warning保留为当前门禁事实，不冒称零告警。

本次仅格式调整，没有改变业务语义；之前PG9是同逻辑的实际证据，没有为格式再抢占服务或数据库窗口。生产与测试已重新冻结，根任务据最新源码重新计算哈希并启动force+全50；本报告不代替其尚在运行的最终结果。
