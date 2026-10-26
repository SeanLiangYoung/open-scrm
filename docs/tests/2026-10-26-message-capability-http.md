# 消息渠道能力真实HTTP验收

2026-10-26，Node20.20.0、全新PostgreSQL16/Redis7，以及实际auth/message/gateway。独立脚本 `code/scripts/test/overnight-message-capability-http.cjs` 首次实际运行30组断言全部通过、exit0。没有API Mock，没有接通外部消息提供方；类型5为明确模拟，1至4由发送器能力检查拒绝。

## 实际覆盖

两个企业都经过真实登录；创建五种类型模板，包括显式Mock5，验证实际DTO能力。对1、2、3、4各验证初发、批量、模板、历史成功幂等请求返回400，共16组。请求类型5但相同键指向旧类型1成功行也返回400，避免把历史占位成功重放为当前确认。所有拒绝请求后SQL确认日志仍只有9条种子行，四条历史成功的内容、状态、重试次数和空发送时间原样保留。

四种渠道的失败日志经真实重试接口处理，均返回success0/failed1，数据库保持失败状态2、retry_count1、send_time空，写入明确“消息渠道尚未接通”原因。每次请求混入另一企业Mock失败ID并携带伪造企业头，另一企业行保持失败、retry_count0、原始内容不变。

显式5初发与同键重放成功并返回同一日志ID；批量两目标成功；模板成功；第二企业使用相同幂等键并携带伪造第一企业头仍创建自己独立的成功记录。此处成功指模拟流程完成，不代表真实送达。

最终SQL精确14条消息日志：原四条历史占位成功未改写、四条未接通渠道失败、另一企业一条原始Mock失败、新增五条明确Mock成功。`explicit-mock`键恰好两行、分别属于两个企业。无新增1至4成功记录。

## 执行证据与清理

```bash
PATH=/Users/seanliang/.nvm/versions/node/v20.20.0/bin:/tmp/open-scrm-tools:$PATH node code/scripts/test/overnight-message-capability-http.cjs
```

证据目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-message-capability-http-XNbzXm`，含result.json和database-evidence.txt。结果checkCount30、expectedMessageRows14、testsPassed true、cleanup.passed true、passed true，exit0。PG57904、Redis57913、auth57946、message57947、gateway57948；自有服务进程95708/95834/95926全部退出，两个自有容器确认不存在。脚本在清理完成后写最终结果，清理失败会使整体失败。

这次只增加独立HTTP脚本和报告，不修改业务代码、旧harness、CI或runner。未验证真实渠道、真实供应商回执、跨服务恰好一次或历史成功指标回填。历史占位日志仍是历史事实，不应纳入真实送达率解释。

渠道修改后独立复跑 `overnight-message-retry-http.cjs`：八组断言全部通过、SQL精确3行、exit0，证据 `.../open-scrm-message-retry-http-YaJqwJ/result.json` 的testsPassed/cleanup.passed/passed均true。PG58603、Redis58620、auth58657、message58658、gateway58659，所有自有服务与容器确认清理；验证匿名401、混合与外企隔离、无效DTO400、两企业自己Mock重试及成功不重发均保持。

## 营销能力检查优先级扩展（实际39组通过）

controller能力检查提前后，独占重新构建auth/message/gateway并完整运行扩展脚本：39组全部通过、exit0。客户9001无授权时渠道1至4四请求均400渠道未接通；插入一条明确授权并设置该客户Bangkok当日日桶999后，渠道1至4另四请求仍400，不被静默/频控429遮蔽。无授权阶段Redis策略键集合为空且前后相同；额度饱和阶段当日策略键值999保持，未增加任何键或计数。授权前后计数及插入的授权行保持，八次拒绝后消息表仍9种子行。最后完整旧30组也通过，最终仍精确14条日志。

本次证据：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-message-capability-http-becTVC/result.json`，checkCount39、expectedMessageRows14、testsPassed/cleanup.passed/passed均true，包含Redis前后policySnapshots。PG60899、Redis60920、auth60937、message60938、gateway60939；全部自有服务进程和两个容器确认清理。上述30组XNbzXm及retry八组YaJqwJ为先前独立运行证据，本次39组为最终扩展证据，不应相加称独立功能数。未再修改业务代码或旧retry脚本。

## 最终历史键营销副作用回归（实际40组通过）

根执行者增加异步assertSendAvailable后，再次独占构建三服务并运行完整脚本40组，全部通过、exit0。新增的真实v1营销组合为：请求5、已有渠道1历史成功同键、客户有效授权、当日日桶999。结果400且原因是渠道未接通；Redis全部策略键和值前后相同，历史成功行及消息日志9种子行不变。原39组也保持通过，最终消息日志仍精确14行。

最终证据目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-message-capability-http-cRlR25`。result.json记录checkCount40、expectedMessageRows14、testsPassed/cleanup.passed/passed均true。PG49593、Redis49617、auth49648、message49649、gateway49650；自有服务进程99768/99789/99813退出、两个自有容器确认不存在。此为最终40组证据，先前30/39组为逐次扩展的历史执行，不相加统计。

该HTTP结果验证已存在历史键的拒绝优先级和Redis不变；发送服务继续保留existing及唯一冲突raced记录自身渠道检查。未声称覆盖所有并发创建旧渠道记录的额度线性化。
