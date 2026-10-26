# 夜间交付证据（执行中）

当前04:17：最新无缓存单元已通过：82文件/1086项、17任务成功、0缓存；日志 `/tmp/open-scrm-unit-force-final-integrity.log`。统一注册50阶段（static4/browser14/database10/http22），尚未把注册数称为全跑通过。历史40轮39通过/1工具失败/0跳过保留，下文记录工具修复。新增只读审查确认扫码计数/重试、内容路径/批推、管理员重置密码/角色全批三组缺口，已重新分配三路修复，根继续同步事实与整体验收准备。08:00收口不变。

## 01:55 主执行者复验快照（历史）

此段追加最新结果，不改写下文历史数量。统一入口 static 组2阶段通过、0失败、0跳过，内部全库8门禁通过；Vitest合计60文件/441项通过，登录状态真实Pinia/Vue内存检查10项通过。报告 `/tmp/open-scrm-unified-static-1792950363980/manifest.json`。

主执行者browser组6阶段通过、0失败、0跳过，共77项模拟API的Chromium用例，报告 `/tmp/open-scrm-unified-browser-1792949998808/manifest.json`。database组6阶段通过、0失败、0跳过，包括客户24、SOP事务5、统计7、客户分配14、通知事务6项检查，以及五服务16实体/195列审计，报告 `/tmp/open-scrm-unified-database-1792949998808/manifest.json`。不同层级不相加冒充业务用例总数。

企业登录真实HTTP/UI由主执行者独立复验5项通过（open-scrm-tenant-login-IUBFqu）。显式OSS夹具的五服务启动独立复验通过（open-scrm-runtime-boot-mBEVlj）。主执行者完整统一HTTP组8阶段通过、0失败、0跳过，报告 `/tmp/open-scrm-unified-http-final/manifest.json`。其中客户跟进1、同意3、运营5、员工4、统计11、客户真实UI3、企业登录5，共32项实际HTTP/UI用例，另有五服务启动阶段；启动不是浏览器用例。全部清理验证通过。统一runner自检主执行者复验13/13通过（scrm-runner-selfcheck-7CyqNH）。CI已复用相同分组并上传清单和日志，YAML解析成功，未执行远程CI。

此后审查新发现并正在修复：两端旧请求迟到401会清除新会话；消息失败重试缺少企业过滤。上面的绿色快照不能当作这两个新增修复的最终证据，须待红绿回归和复验。

追加会话修复证据：迟到401隔离已完成，真实Axios/Pinia/Vue探针16/16由主执行者独立通过；主执行者新增实际Chromium回归，两端完整登录套件各11/11通过，共22项，模拟API，不是后端联调。当前browser组对应79项，旧77项保留为历史快照；统一入口当前23阶段（static新增该探针），完整23阶段还未复跑。详见[会话计划](../plans/2026-10-26-session-response-races.md)和[审查报告](./2026-10-26-auth-boundary-review.md)。消息重试隔离已完成单元红绿，真实双企业HTTP仍进行中。

02:10追加：消息重试由主执行者独立真实HTTP8组通过（open-scrm-message-retry-http-yHMQKd），渠道能力39组独立通过（open-scrm-message-capability-http-aId10r），两次均exit0且清理验证通过。随后复核发现v1营销请求5遇旧渠道1同key仍提前消耗quota，已用新增controller红测复现并修复为异步企业内历史能力预检；消息最新15文件153单测通过，新增真实HTTP40组待复验。渠道旧成功不改写，真实渠道未接通。

SOP路径编号修复：48非法红测转绿，连同8合法，共56项通过；运营完整8文件123项与类型检查通过。独立HTTP新增23请求验证非法400和原模板不变，原5项用例仍全部通过，清理确认，见[路径报告](./2026-10-26-sop-path-http.md)。SOP编辑器显式Mock5与旧配置保留新增8项Chromium由主执行者通过（/tmp/open-scrm-sop-mock-parent.log）；当前browser注册7套件共87项，整体26阶段，尚未将注册数量称作最终全跑结果。

02:12主执行者补充无缓存全库单元：`pnpm exec turbo run test --force`，17任务成功、0缓存、0失败，实际12个测试包共65文件/552项通过，日志 `/tmp/open-scrm-unit-force-current.log`。26阶段统一all正在执行，static3已通过，内部8门禁全部通过；报告目录 `/tmp/open-scrm-unified-all-26`。后续三业务切片仅准备新测试，不改业务源码，保持本轮生产代码稳定；源码释放及后续结果另追加。

## 02:18 完整26阶段实际结果

主执行者执行 `PNPM_EXEC=/tmp/open-scrm-tools/pnpm node scripts/test/verify-reliability.cjs --group all --report-dir /tmp/open-scrm-unified-all-26`：**26通过、0失败、0跳过、退出0**，结束UTC2026-10-25T18:18:08.926Z。static3/browser7/database6/http10全通过。逐阶段清单、耗时和日志在该目录，279个生产src文件哈希保存在production-source-sha256.json；哈希仅标记源码，不替代测试范围。

- static包含8工程门禁、10项登录store及16项Axios会话响应检查；无缓存65文件552单元另有前述独立日志。
- browser共87项模拟API用例，不当作真实后端送达。
- database包括客户24、SOP5、统计7、分配14、通知6项及五服务16实体195列审计，保留不同层级。
- http包括32项Playwright真实HTTP/UI用例、重试8组与渠道40组原生HTTP断言，以及五服务显式OSS夹具启动。所有临时资源清理验证成功，外部渠道未接通，Mock不会真实送达。

新增修复的真实证据（包含历史key营销额度边界及SOP路径23请求）已进入本轮。未执行远程CI。随后02:18明确释放源码，M13–M15三个UI任务进入实现；此完整快照不冒充它们的验收结果。

这是持续执行期间的证据索引，尚未到08:00收口，也不表示所有后续任务已完成。[量化计划](../plans/2026-10-25-overnight-execution.md)定义范围；[首轮报告](./2026-10-25-overnight-progress.md)保留先前快照，不用后来数量改写历史。

## 验收项与当前证据

1. **工程基线**：主执行者完整执行 `pnpm test`，8个检查通过、0失败，分别保留日志 `/tmp/open-scrm-continuous-gates/check-1.log` 至 `check-8.log`。随后一次无缓存单测为52文件/264项通过；之后SOP新增13项用例，运营服务独立全套达到6文件/64项通过。最新客户分配功能仍开发中，最终全库数量须重新取得，不能把中间快照写成最终结论。

2. **客户跟进企业隔离与输入**：真实PostgreSQL16.13控制器/TypeORM检查24项；主执行者重跑真实auth→gateway→customer HTTP，1测试/8步骤/24次请求、0跳过，两个企业通过真实登录取得JWT，双向越权拒绝，伪造头和正文身份不生效，最终精确4条夹具记录。详见[数据库报告](./2026-10-26-customer-postgres.md)和[HTTP报告](./2026-10-26-customer-http.md)。

3. **营销同意闭环**：`/messages/consents/grant`与`/revoke`均要求可信企业/操作者；同一客户事务行锁、保留历史、撤回全部有效授权。主执行者真实HTTP2测试通过/0跳过，授权→Mock发送→撤回→拒绝、双企业登录隔离均覆盖；SQL精确4条已撤回授权和3条正确企业Mock日志。详见[同意HTTP报告](./2026-10-26-consent-http.md)。

4. **SOP控制与数据保留**：暂停/取消不被进度覆盖、完成步骤不重放、长延时分段防溢出、旧worker异常后恢复；模板步骤替换使用同一事务与行锁。真实PG16的5项检查覆盖约束失败回滚保留旧步骤ID/内容、跨企业拒绝及并发完整替换。入口 `bash code/scripts/test/overnight-sop-postgres.sh`。

5. **SOP跨服务语义**：客户目标1保留；群目标在SOP为2、消息服务为3，已在消息/素材调用处映射。发送必须得到HTTP200之外的明确结果（外层成功且单条成功1/失败0）；失败计数、缺失计数、矛盾计数会记录失败并停止下一步。根执行者观察2项映射回归与9项错误成功回归先失败，修复后运营64项全部通过。主执行者进一步亲跑真实operationHTTP5项通过，四个服务实际启动，5条Mock成功日志；受控HTTP200失败不写发送日志，SOP进度0且失败。详见[运营HTTP报告](./2026-10-26-operation-http.md)，主线程独立证据目录`open-scrm-operation-http-XngnnQ`。

6. **统计快照**：overview有显式`snapshotAvailable`区分缺失日表与实际观测零；旧行缺少采集时间仍视为存在。正常/已删除/启用库存使用准确字段，区间只取最后快照。主执行者分析14项单测和真实PG16的5项检查通过，详见[分析数据库报告](./2026-10-26-analytics-postgres.md)。

7. **运营浏览器**：主执行者亲跑25项Chromium/模拟API契约通过，覆盖跟进成功/失败草稿保留、上海时间转UTC、列表刷新、看板准确字段/采集时间/无快照/部分请求失败、分页总数与样本标注、SOP旧动作往返、素材输入、空步骤拒绝、群不兼容步骤拒绝。入口 `playwright test --config operation-contracts.config.ts`；API均模拟，不等于真实后端送达。

8. **群发浏览器与ID边界**：主执行者亲跑15项模拟API浏览器检查通过，数值状态/字段、目标ID去重与验证、零状态筛选、执行确认/取消和字符串bigint边界均覆盖。后端取消另有13项控制器检查，宽松parseInt已替换为安全十进制正整数校验。入口 `playwright test --config mass-task-contracts.config.ts`；仅显式Mock文本执行，新建与执行真实渠道没有被宣称可用。

9. **CI与诊断**：配置单元/类型/lint/构建门禁、隔离数据库/HTTP业务链和独立Chromium任务；Bash pipefail避免tee掩盖失败，失败保留日志及截图/trace。这里只证明配置与本地等价命令，未推送远程，未宣称CI已绿或合并保护已设置。

## 原可靠性需求到代码和证据的映射

- 企业跟进与输入：`customer-service/src/controller/follow-up.controller.ts`、`entity/follow-up.entity.ts`及幂等迁移；24项PG、1项真实HTTP/24请求、真实客户UI覆盖。身份仍依赖可信网关内部头。
- SOP控制与模板保留：`operation-service/src/service/sop-execution.service.ts`、`sop-template.service.ts`和`sop.controller.ts`；运营123单元、PG事务5、真实HTTP5及新增路径23请求。进程内guard不等于重启恢复或跨进程exactly-once。
- 授权与渠道真实性：`message-service/src/controller/consent-api.controller.ts`、`message-api.controller.ts`、`service/consent-record.service.ts`和`message-send.service.ts`；同意HTTP3、重试8组、渠道40组。Mock不外发；旧渠道成功不重写，不能当真实送达率。
- 统计快照与归因：`analytics-service/src/service/daily-stat.service.ts`、`funnel-gap-query.service.ts`及window/summary工具；21单元、7PG、11真实HTTP。不把库存累加为事件，不把窗口归因当因果。
- 登录及会话：`auth-service/src/service/auth.service.ts`、`controller/auth.controller.ts`、gateway认证/代理中间件，以及两端`stores/auth.ts`、`utils/api.ts`；登录真实5、登录浏览器22、store10与Axios16。未新增自动刷新、refresh轮换或服务端撤销。
- 员工与归属：auth的`staff.controller.ts`、customer的`customer.service.ts`、message的`notification.service.ts`及运营`TenantStaffSelect.vue/useTenantStaff.ts`；员工20单元、分配14PG、通知6PG、员工HTTP4、真实客户UI3及人员浏览器13。员工检查不宣称所有消息客户/群目标已权威校验。
- 可重复验收：`scripts/test/verify-reliability{,.selfcheck}.cjs`、`full-test.sh`与根CI；13编排自检、完整26阶段、独立退出码/日志/清理。远程CI尚未运行，新增UI不继承旧绿色快照。

以上代码短路径均以code目录为根，各详细报告提供命令、夹具、精确结果与限制。后续三个运营UI的需求映射追加到各自独立报告，不伪造当前授权读模型。

## 资源与安全边界（沿用）

隔离脚本不连接现有业务数据库，容器只绑定loopback、不挂载业务卷，退出核验自己创建的进程与容器。清理失败已通过故障注入证明返回非零；端口占用启动失败在Docker29.4.0中验证无残留，此结论不扩大到所有Docker故障。真实HTTP使用消息类型5，未发送外部消息；operation联调还使用只准显式Mock的安全转发层。

内部服务身份头仍依赖可信网关/内部网络；不是全系统零信任认证改造。SOP执行guard仅单进程、重启不恢复延时、下游副作用与进度不具备跨服务exactly-once。完整收件客户/群/员工归属验证尚未全覆盖，Mock可产生调用企业内的未验证引用记录，不能据此宣称真实跨企业消息触达，也不能把模拟成功当作外部送达。群目录目前没有完整权威落库。

## 正在继续的必要工作

- 实际operation服务HTTP5项已亲跑通过；新增API改动后仍须重新验证。生产构建排除测试模块，Mock群发/SOP客户与群、控制状态和内部失败均有证据。
- 客户创建/更新的员工归属校验与表单实际DTO修复；同企业有效员工可分配，外企/缺失/停用员工在保存前拒绝。
- 最终代码交叉审查、按最新源码完整回归、CI入口和文档数量同步。
- 08:00收口前逐项审计，届时填写最终完成/未完成项并停用备用续跑。

## 02:38 完整32阶段快照

目录 `/tmp/open-scrm-unified-all-32`，manifest结束UTC2026-10-25T18:38:17.593Z，32通过/0失败/0跳过/exit0。生产src哈希281项前后完全一致。追加UI代码和各harness guard修复均已通过正常链路；安全脚本异常启动3组另在scrm-ui-harness-safety-snfSGw通过，真实daemon核验创建容器均已删除，业务服务未启动，整体失败退出未丢失。CI单独执行此安全门禁并上传工件，未远程运行。

需求映射追加：通知中心`NotificationCenter.vue`＋员工目录组件，18Mock/3实际UI，发送与列表两类竞态已红绿并经独立复核；消息日志`MessageLogs.vue`＋路由/侧栏，14Mock/4实际，部分企业边界为真实API负向检查，未伪称UI操作；客户授权`CustomerMarketingConsent.vue`＋详情集成，10Mock/4实际，同意闸门和跨企拒绝通过真实API确认，只显示本次操作结果，没有状态读模型。各独立报告详列SQL、截图和限制。

## 后续读模型批次（40阶段复验中）

已完成源码及各自验证：通知历史新12/原18浏览器+37行真实3场景；授权读模型39新后端、6PG（根独立open-scrm-consent-read-pg-jayhmZ通过）、14原生HTTP、根17读浏览器/原10及真实UI5；趋势analytics52单元/9新浏览器/旧25/历史8真实场景，最新严格身份补丁待根实际复验。

根无缓存 `pnpm exec turbo run test --force` 17任务通过、0缓存，71文件627项；日志 `/tmp/open-scrm-unit-force-read-models.log`。统一all40当前执行于 `/tmp/open-scrm-unified-all-40`，开始生产src287文件哈希已保存，尚不记全40通过。额外安全门禁扩大为6组无profile拒绝及真实Docker create后start失败清理，结果6通过0失败，证据scrm-ui-harness-safety-yNBbQP，独立于40阶段。

## 40阶段结果与新增重要缺陷

本轮 `/tmp/open-scrm-unified-all-40/manifest.json`：39通过、1失败、0跳过，exit1，UTC19:13:52.173Z结束。287生产src哈希解冻前一致。失败customer-ui因工具禁止一切messages前缀，误拦新增只读授权GET；整体失败不改写。根修为仅允许精确GET /consents/customer/:id，所有消息写/日志/通知调用继续拒绝，九策略断言并入14编排自检；旧工具并补strict profile与create登记start，七组真实Docker故障/入口检查通过（scrm-ui-harness-safety-GrFnUV）。最新源码尚待后续整轮。

独立深入审查又确认标签主键/企业mass-assignment、消息模板路径/引用、SOP无效配置转换等重要问题。标签已在专用PG真实复现，open-scrm-tag-integrity-pg-O55NqX为预期红6/7，清理通过；不能把红测试计成产品通过。三个独立修复计划正在执行，故本报告不宣布全项目或所有重要问题已清零。
