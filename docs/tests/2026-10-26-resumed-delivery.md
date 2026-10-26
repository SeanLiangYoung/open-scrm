# 三组修复续办交付（验收中）

用户明确授权：完成中断的M25–M27、独立复核并执行当前注册的50阶段，不停在局部绿色。此次没有恢复夜间自动化；旧中断交付保留历史事实。

## 验收清单

- [x] M25 扫码：规范INT32路径、持久24h幂等、原子计数与归因、失败后可重试、实际PG并发与维护清理。
- [x] M26 内容：规范safe BIGINT路径，真实PG字符串水合同源比较，错误来源仍拒绝；外部发布仅受控桩。
- [x] M27 管理员：密码重置min8、用户路径规范、角色全批事务与缺失拒绝；合法全局管理保留。
- [x] 根独立代码复核与局部证据重跑（交叉审查结果另收集）。
- [x] 最新源码固定后50阶段全量，保留manifest与每阶段日志。
- [x] 资源清理、事实文档、剩余问题及最终交付。

编排14项自检及额外7组真实Docker启动失败清理本轮通过，分别见 /tmp/open-scrm-resume-runner-selfcheck.log 与 /tmp/open-scrm-resume-harness-safety.log。这些不替代业务验收，也不相加进50阶段。

## 根独立复验（全50运行前）

无缓存全库命令 `PATH=/tmp/open-scrm-tools:$PATH pnpm exec turbo run test --force`：87文件1320项全部通过，17任务成功0缓存；日志 /tmp/open-scrm-resumed-force-unit.log。

内容单元148、扫码单元46分别独立重跑通过；当前源码实际PG命令为 `node scripts/test/overnight-channel-scan-postgres.cjs`、`node scripts/test/overnight-studio-identifiers-postgres.cjs`、`node scripts/test/overnight-admin-user-postgres.cjs`，各12/6/9组通过且持有容器清理确认。日志分别为 /tmp/open-scrm-resume-scan-pg-parent.log、/tmp/open-scrm-resume-studio-pg-parent.log、/tmp/open-scrm-resumed-admin-pg-parent.log。扫码清理自检另6项通过，不加进业务用例总数。

已开始 `PNPM_EXEC=/tmp/open-scrm-tools/pnpm node scripts/test/verify-reliability.cjs --group all --report-dir /tmp/open-scrm-resumed-all-50`，当前仍进行中。296个生产src文件验收前指纹 /tmp/open-scrm-resumed-source-before.json；结束须比较后才能声称稳定快照。

CI另加三组专属PG和扫码清理自检，不改变当前50注册表；远程CI未执行。

## 首轮全50中止与实际失败（保留）

/tmp/open-scrm-resumed-all-50/manifest.json 为3通过、2失败、45跳过、exit1。workspace内部7门禁通过、auth新增源码Prettier37错误使lint门禁失败；后续operation Mock阶段因根主动SIGTERM中止，余阶段跳过。根中止原因是独立审查用真实PG屏障确认：过期幂等续期在save的SELECT后/UPDATE前被全局清理删除，commit计数却无receipt，同key再计2。原12组PG未覆盖此交错，不可据旧绿色否认缺陷。原probe /tmp/open-scrm-scan-review-race.cjs 与artifact open-scrm-scan-review-race-WRpoHr 保留红证。修复后重新冻结并从头全50。

## 扫码续期竞态补修独立证据

最小生产修复：在事务中读取已有receipt时增加pessimistic_write并保持至提交，维护清理使用SKIP LOCKED。根独立重跑原 /tmp/open-scrm-scan-review-race.cjs 已通过（/tmp/open-scrm-resume-scan-race-parent.log），再重跑仓库持久化PG脚本13组全部通过（/tmp/open-scrm-resume-scan-pg13-parent.log），cleanup严格确认通过。作者全服务47单元/类型检查通过，待最新无缓存总回归重新计数。旧12组/1320只保留原快照。

## 最新无缓存与环境阻挡记录

补修和auth格式后根无缓存87文件1321项/17任务全通过，0缓存；/tmp/open-scrm-resumed-final-force-unit.log。根auth lint重跑0errors/27warnings；/tmp/open-scrm-resumed-auth-lint-parent.log。

第二轮全量 /tmp/open-scrm-resumed-final-all-50 在执行中，workspace8门禁已通过。一项operation-contracts首次被上一中止轮遗留Vite87320占用3103阻挡；根核对PPID1、启动时间与cwd属于本次拥有测试后TERM精确PID，端口释放。该项独立重跑25/25通过，日志 /tmp/open-scrm-resumed-operation-port-retry.log；原失败保留，不改manifest。其它阶段继续完成，随后以清理后的稳定环境再取完整新清单。

当前轮另发现operation-http 4通过1失败：删除编号的正常对照用steps:[]创建模板，被M23严格步骤DTO以422拒绝。保留原失败，正在核对契约后修正旧夹具，不能通过降低新业务校验换绿色。其它独立阶段继续执行。

旧夹具修正已冻结：operation-http删除对照改为合法Mock5单步骤且不触发，5测试数和既有断言保持；staff-http明确分开有效格式但外企/停用/缺失/混合集合400，与空/非正数组DTO422，原成功数量/SQL检查保持。没有改生产校验或泛化为任意4xx。后续全50须实际验证这些修正。

## 第二轮完整50结果（保留原失败）

/tmp/open-scrm-resumed-final-all-50/manifest.json：47通过、3失败、0跳过，exit1，结束2026-10-26T13:37:31.467Z。失败精确为operation-contracts端口占用、operation-http旧空steps夹具、staff-http旧400/422预期，其它47阶段通过。端口归属已确认并清理；两旧测试仅修输入/精确预期，未改变业务规则或测试数。

根已启动最后完整重跑：/tmp/open-scrm-delivery-all-50。运行前指纹：296生产src(/tmp/open-scrm-delivery-source-before.json)与158验收输入(/tmp/open-scrm-delivery-inputs-before.json)。所有业务源与测试冻结，不与其他dist构建并行。


## 报错后接续完成：2026-10-26 21:50（北京时间）

原对话最后因所选模型容量已满而报错，其已启动的最终全量进程仍在运行。本对话接管观察，没有重复启动全量、修改生产代码或中断测试。最终完成时间为北京时间21:50:09。

**当前注册全量50阶段：50通过、0失败、0跳过，exitCode=0。** 分组为静态4、Mock浏览器14、数据库10、真实HTTP/含UI及启动22。workspace阶段内8项门禁全部通过，包括单元、共享包构建、类型、lint及服务构建。Mock结果与真实HTTP结果按清单分组，真实外部渠道仍由受控桩隔离。

接手后另实际运行全库无缓存单元：87文件1321项，17任务成功、0缓存，命令为 `PATH=/tmp/open-scrm-tools:$PATH pnpm exec turbo run test --force`。三组当前源码隔离PG另重跑：扫码13组、内容6组、管理员9组，全部通过且专属容器清理确认成功；这28组不计入50阶段数量。内容生成外部依赖仅为本地桩，externalAttempts=0。

结束后逐文件计算SHA256：原冻结296生产源码与158记录输入均无变化。158条包含两个原有生成报告，因此与当前rg枚举156条有差异；两项原报告亦未改变。完成后 `docker ps -a --filter label=open-scrm.verification` 无残留，未发现本轮verify-reliability/overnight测试进程，`git diff --check`退出0。现有业务资源未修改。

可持久复核的[完整50阶段清单](evidence/2026-10-26-recovered-delivery/all-50-manifest.json)、50份逐阶段日志、无缓存单元及三组PG日志、[文件一致性结果](evidence/2026-10-26-recovered-delivery/fingerprints.json)已复制到仓库的 `docs/tests/evidence/2026-10-26-recovered-delivery/`。清单内原始绝对日志路径保留运行事实；同名日志已同时归档。前两轮失败记录保留，不回写为通过。

## 剩余问题与部署边界

- 真实消息渠道1–4尚未接通；Mock5及本地桩成功不能证明真实发送、生成或发布成功。
- 扫码新增持久凭据表须在既有数据库先施加迁移，本轮没有操作既有业务数据库。Redis旧键未迁移，切换窗口仍需停写或隔离；无事件ID重试仍不保证幂等。闲时过期清理由部署维护安排。
- SOP仍有进程内调度限制；本次未扩展为持久调度。
- 内容工作台专属PG覆盖当前服务方法与控制器调用，未新增其全部真实HTTP路由覆盖；Asset参数/引用及网关不匹配等独立待办未因本批通过而解决。
- 管理员未扩展完整SSO/RBAC、会话撤销及删除依赖审计；user_role缺少外键的直接SQL后续删除限制仍保留。
- auth lint保留27条warning，门禁0error通过；远程CI未运行。
- 工作树全部保留，本轮未提交、推送或部署。此次完成范围为M25–M27修复验收与当前50阶段收口，不代表整个产品已无待办。
