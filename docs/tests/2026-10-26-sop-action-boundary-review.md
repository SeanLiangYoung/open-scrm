# SOP动作配置与执行边界独立只读审查（2026-10-26）

状态：发现待修缺陷，**未改生产源码、已注册spec或构建产物，未启动真实HTTP/数据库/Bootstrap**。审查发生于根任务ALL40回归期间，修复须等待明确释放。已修的暂停/恢复、事务替换、路径参数和已知进程内运行限制不再重复报告。

## 证据方法与限制

新独立探针 `code/scripts/test/probes/sop-action-boundary-review.cjs`，运行：

```bash
node code/scripts/test/probes/sop-action-boundary-review.cjs
```

本次exit0，输出保留 `/tmp/sop-action-boundary-review-evidence.json`。脚本从当前TS源码即时transpile，只运行SopExecutionService、CustomerService、NotificationService的方法；框架装饰器/依赖类型替换为无副作用适配器，repository及HTTP为内存适配器。实际Midway getSchema对当前BatchCreateStepsDto、CreateNotificationDto做校验。没有使用dist、没有启动服务或接触用户数据。这里是当前服务方法链的可复现探针，**不是实际HTTP、真实事务锁或PostgreSQL证据**；exit0表示重现并断言缺陷，不表示期望行为已通过。

本轮10个可复现观察：3个实际嵌套DTO接受配置；4个分配错误转换；1个通知错误转换；1个标签未生效仍完成；1个负延迟跳过。所有目标资源由内存fixture提供，没有第三方消息发送。输出externalConnections=0是这套无外部适配器执行范围的说明，不是覆盖任意SDK网络层的计数守卫。

## P1：动作员工编号被宽松转换，非法配置可落到非预期员工

位置：`code/services/operation-service/src/service/sop-execution.service.ts:320–326`；通知透传在334–349，实际通知DTO与NotificationService随后校验。

分配步骤仅检查Number(value)有限，再Number(value)提交。探针分别传入followUserId为true、'1e0'、'0x1'、[1]，全部实际提交数字1。接入当前CustomerService.update方法及本企业启用员工1fixture，原followUserId7被改成1，SOP currentStep1/status1。此处不受下游正安全整数校验保护，因为上游已经把错误类型转换成合法1。

提醒步骤不先校验canonical员工ID，直接传userIds。当前实际CreateNotificationDto把['1e0']转换为[1]；随后NotificationService的数字/归属检查通过，在内存事务适配器中产生userId1的站内通知，SOP status1。这里是数据库站内通知，不是Mock消息5或外部渠道；不能因为没有第三方调用就忽略错误收件人。

BatchCreateStepsDto的steps目前只声明array.items(object)，嵌套actionContent不做动作级校验；实际schema确认true/'0x1'/[1]动作配置会被接受。正常最新UI选择器会严格生成数字，但持久化API/历史配置仍可形成该执行输入，不能用前端校验代替执行边界。

**影响边界：** 此次没有证明绕过跨企业/停用检查。下游CustomerService/NotificationService仍按corp/status验证。已证明的是非法配置转换成同企业另一合法员工，导致分配/通知对象与原始配置的类型语义不一致。

建议：在SOP执行边界统一接受JSON正安全整数；若兼容字符串，只接受规范十进制字符串，拒绝boolean、array、object、指数/十六进制、前导零、空白和不安全值。主键不能借Number宽松解析修复。对followUserId/staffId和userIds/userId一并处理，持久化校验另加防线；失败应在任何下游写前终止并记失败。不要修改全局旧helper或静默把旧配置换成员工1。

## P2：不存在/外企标签被过滤成空集合，动作未生效却记录成功

位置：SOP addTag 发送后不检查效果；`code/services/customer-service/src/service/customer.service.ts:224–238`查询本企业tag集合，未验证请求集合全部匹配即保存客户。

探针对现有本企业客户提交tagIds=[9999]，tagRepository按当前真实查询条件返回[]（代表不存在或不属该企业），CustomerService.addTags仍保存且正常返回。SOP随后currentStep1/status1，但客户tagCount仍0。部分有效+部分无效的列表也会静默只做部分效果。

这没有把外企标签加给本企客户；问题是缺失/错误标签配置造成无效果或部分效果却宣告动作完成。不能仅在SOP端要求目前并不存在的HTTP count字段，目标API现有成功响应没有完整效果证明。

建议下游在变更前验证请求的去重安全ID全部匹配本企业实际标签，任一缺失整体失败；已存在的正确标签应保持幂等成功，不要求每次新增数量>0。应覆盖已有标签、重复、混合无效/外企、零匹配与SOP失败进度。该修复涉及customer所有权，须根任务分配，不在本次只读审查跨域修改。

## P2：嵌套步骤接受负延迟，执行直接跳过并完成

位置：`sop-step.dto.ts` BatchCreateStepsDto.steps只检查object；单独CreateSopStepDto的delayTime.min(0)不会递归应用于该数组。`sop-execution.service.ts:118–122`仅在delayTime>0时进入已修的delay()校验，负值绕过。

实际schema接受delayTime=-3；探针用分配步骤配置-3，执行立即分配员工1并status1。这个问题不同于已修的大整数timer溢出：后者在delay()内防护，负值根本不进入delay()。没有通过真实时钟等待证明其他延迟单位，本次不把未验证的单位情况列为额外缺陷。

建议保存与执行两层检查有限非负整数延迟及允许单位；执行必须在是否等待判断之前验证。旧非法配置记失败而不是立即执行，不能靠默认minute或强制0悄悄补救。

## 其他已核对边界

- 当前sendMessage/pushMaterial明确把SOP group2映射message group3，并校验HTTP200内单目标success1/failed0；这里没有再报告已修问题。messageType缺省仍走旧1，由后端capability拒绝；新UI创建明确5，不能把旧渠道静默改5。本次探针没有发送任何Mock或真实渠道消息。
- 提醒接收人仍会经过实际启用/本企验证；分配客户目标仍经过customer归属验证。execHeaders固定user1可能影响未来审计语义，但当前被审目标服务没有据此改写另一客户/收件人，本轮未把它提升为已证明错误归属。
- UI保存动作保留savedAction元数据，旧JSON/plain-text解析与标签/提醒alias规范化有现有独立回归；triggerCondition未编辑时更新请求省略，由后端保留。改动作类型主动清理旧动作字段是显式类型切换。没有观察到新的纯改名元数据丢失证据，不制造重复缺陷。
- 模板步骤写入白名单与既修事务不在本轮重做；未知stepType会抛错，不能据此声称所有无效动作都被记成功。当前发现集中在合法stepType内的配置验证缺口。

以上已先报根任务。待ALL40完成并明确授权后，先把重现转换为注册回归的期望拒绝测试，再分别修SOP配置边界及下游标签原子验证，最后由根任务安排隔离实际链路；当前报告不声明缺陷已修复。

## 后续修复状态

根任务解除冻结后，上述SOP配置边界已实施共享保存/执行校验；标签全批验证由customer任务独立实施。最新单元与实际12场景证据见[动作配置验证报告](2026-10-26-sop-action-validation.md)。本页原探针是“断言缺陷仍存在”的历史重现器，修复后不再作为绿色验收入口；正式回归使用新增注册单元测试及独立SOP action HTTP harness。探针已能解析新增纯校验helper，避免把导入适配错误误当缺陷修复证据。
