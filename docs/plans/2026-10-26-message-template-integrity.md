# 消息模板引用与路径编号完整性

状态：ALL40源码冻结期间仅新增计划/失败测试，主执行者明确解冻后实现。依据[只读复核](../tests/2026-10-26-message-template-boundary-review.md)。本切片不改consent/read/notification逻辑，不接通真实渠道，不调整runner/CI或共享运营README。

## 决定与兼容范围

1. MessageController模板详情/更新/删除、旧日志详情和MessageApiController v1日志详情，路径必须规范十进制正安全整数。畸形/超安全路径400，在调用服务/仓库前拒绝；合法本企行为保持，现有企业过滤保持。不能用parseInt吃尾字符、截断小数或舍入大ID。当前读方法仍用number，超过安全范围明确拒绝；历史大ID列表可字符串展示，不声称增加大ID详情读能力。
2. SendMessageDto与BatchSendMessageDto的optional templateId若存在必须JSON数字、正安全整数。显式null/数字字符串/0/负数/小数/unsafe均400，不默认缺省。服务直接调用同样拒绝非法值；不传字段仍可发送明确Mock5。
3. 可选templateId在本企业存在才可引用，foreign/missing统一404，任何日志写入前拒绝。只检查归属与存在，不增加模板启用状态或渠道/正文匹配约束；本企停用模板作为引用仍可关联，explicit content仍调用者自己提供。独立sendByTemplate继续原本“本企模板且启用、渲染正文”的规则。
4. v1发送在consent、Redis policy及任何幂等读取前验证引用。sender.sendMessage和batchSendMessage自身也验证，不能仅依靠控制器；既有渠道能力与历史/raced行自身channel检查保持。不存在/foreign不能借同key已有成功跳过校验。参数化本企getTemplate，不能先查全局对象泄露归属。
5. 模板查询无写锁，关联验证不宣称解决模板后续删除的跨事务永久引用一致性；本轮不新增FK/迁移/模板内容快照。不得把Mock日志成功称第三方送达。

## 执行

先新增独立路径矩阵与引用测试并观察红；解冻后在message-service小型共享编号工具中实现路径/引用安全解析，控制器与服务复用；DTO局部strict约束templateId，错误按本切片400契约处理，不全球改框架422。保留其他send字段原验证行为；若需要局部DTO错误状态调整，必须在报告说明作用范围，避免隐藏兼容变化。

模板get/update/delete服务直接调用亦保护安全编号，日志详情同样；保持corp where。引用helper在assertSendAvailable前半段调用，且单发/批量入口调用；重复本企读取可以接受，实际发送existing/raced安全检查不能删除。严格ID输入不允许手写企业字段。

## 量化验收

- 至少12引用组合：single/batch各自own、foreign、missing、zero、unsafe、numeric-string；补no-reference保持、own disabled与不同channel引用兼容、v1营销foreign引用在consent/policy/幂等前拒绝。
- 路径矩阵5入口（模板get/update/delete、legacy logget、v1 logget）覆盖合法及尾字符/小数/指数/空白/前导零/非正/unsafe，非法服务零调用；服务直接编号拒绝、外企where保留。
- 实际DTO schema验证optional缺省及严格数字矩阵。新增与现有单元全绿、tsc和实际build通过。
- 新独立PG16/Redis auth/message/gateway真实双企至少5组：A正常模板CRUD；畸形更新/删除不改变本企7等种子；日志畸形/unsafe无错对象；A单发/批量foreign/missing引用404且SQL零新增；A自身disabled/channel不同模板仅引用可用且正文原样；v1营销foreign+同key成功仍404且Redis不增；B可正常引用自己模板。精确记录SQL模板/日志计数和企业归属，不用仅toast证明。
- 真实harness create→立即登记→start，profileguard、启动失败自检、最终进程/容器不存在为passed前提。clean构建/HTTP串行领取窗口，不与其他任务dist并发。

## 审阅结论

计划遵循主执行者指定的最小契约：修路径误中与跨企业引用，不扩展发送能力、不把归属校验变为按模板发送、不重新定义启用语义。ALL40解冻前只新增独立测试，不实现源码；完成后同步消息服务事实源和独立报告。

## 执行裁定（主执行者确认）

有效格式的引用若不存在或不属本企业，统一404；非法格式400，其他既有发送DTO验证保持422。此裁定明确修正早期把引用拒绝笼统写400的目标，不通过放宽测试掩盖状态差异。仅归属/存在校验，不额外要求模板启用或与本次渠道相同。

## 实际int4边界裁定

新增真实请求证实：message_template的SERIAL/int4编号与bigint日志不同，2147483648及MAX_SAFE在模板详情/引用查询产生数据库22003/HTTP500。模板编号改为1至2147483647，超过该DB可表达范围400；日志bigint详情仍允许正安全整数至MAX_SAFE。局部模板DTO/middleware/路径/服务采用模板范围，不把int4上限误用于日志或企业编号。有效范围内但不存在/外企引用仍404。
