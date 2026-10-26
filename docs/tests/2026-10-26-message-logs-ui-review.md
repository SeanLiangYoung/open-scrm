# 消息日志页独立只读复核

2026-10-26。审查当前MessageLogs.vue、现有message-logs.spec.ts十四例、消息日志DTO与发送重试响应。未修改产品源码/既有测试，未构建或启动HTTP；作者正在准备真实脚本，本轮不占用该窗口。

本轮未确认需要修复的重要缺陷。结论仅限下述读取与重试UI行为，不表示完整运营端已审计。

## 独立探针证据

内存提取当前MessageLogs.vue的script setup，经当前TypeScript转译，注入实际Vue ref并以可控Promise替代API，onMounted不触发。另直接加载已安装ElementPlus2.13.2的useEmptyValues，而非猜测清除值。

- 实际ElementPlus默认清除值为undefined；组件没有额外valueOnClear或全局覆盖。状态选择0后，当前loadLogs实际生成page1/pageSize20/sendStatus0；清除后实际参数只有page1/pageSize20，无空字符串筛选。这次未发现“清除发送空值”或“0被当未选择”的问题。
- 两次loadLogs倒序返回：新响应先写new行/total1，旧响应随后返回old行/total99；最终仍new/1/loading false。latestRead检查覆盖成功、失败与finally，旧响应不能覆盖新列表、总数或加载状态。
- 同一失败Mock行连续调用retryLog两次，确认Promise保持pending：实际只出现一次confirm、一次POST。retryingId在确认之前设置，按钮及函数均保护重复调用。确认取消后POST0次、busy恢复null。
- 实际retryResult收到HTTP200的success0/failed1且明细false时，反馈type error和“模拟重试失败”原因。超安全日志字符串9007199254740993经实际safeLogNumber返回null，无精度舍入。

以上探针不连接数据库、Redis或外部渠道，也未运行真实重试，不能替代作者后续实际SQL验收。现有十四项浏览器测试覆盖基础读取/分页/筛选、错误、成功/失败/空匹配/矛盾结果、确认取消、未接通类型和安全ID；本轮读取了这些用例，但没有重新执行它们。

## 源码核对结论

页码固定每页20，筛选更改重置页1，再读取；响应总数必须非负安全整数，错误通过listError显式呈现并保留上次列表。分页或筛选可能触发额外同参数读取，但latestRead保证最终状态，不产生写操作，未列为缺陷。

重试结果必须total1、恰一条明细、明细ID精确匹配请求安全编号，且成功/失败计数与布尔值一致；未知形状和空匹配只提示未确认/无记录。HTTP200本身不能触发成功反馈。读取刷新失败另有listError，不抹掉已经完成的重试结果。

仅messageType5且sendStatus2显示重试入口；待处理/成功和未接通渠道不提供重试。旧成功显示“记录成功”，顶部明确说明包含历史占位/模拟、不代表第三方送达；类型5明确“不会真实送达”，1至4标“尚未接通”。原始日志与目标ID保持字符串展示，仅在严格正安全整数校验后转换请求数字。

本轮未审查分页服务的全部输入边界、历史数据可信性或后端并发重试原子性；这些不是本页面新增承诺。没有修改共享operation README，事实源由主执行者统一维护。
