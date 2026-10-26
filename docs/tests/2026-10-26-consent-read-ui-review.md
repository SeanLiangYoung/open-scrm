# 客户授权读取快照组件独立只读复核

2026-10-26。审查根执行者当前CustomerMarketingConsent.vue及其在CustomerDetail下方全宽展示的接入方式。未改组件、既有测试或后端，未构建/启动HTTP。当前范围未确认需要修复的重要缺陷。

## 当前SFC与真实Vue探针

临时脚本 `/tmp/open-scrm-consent-read-review.cjs` 提取当前SFC script setup并由当前TypeScript转译，在VM内注入实际Vue reactive/ref/watch/nextTick。defineProps绑定真实reactive对象，卸载回调显式触发，API使用可控Promise；没有伪装真实HTTP/数据库。完整探针exit0，输出确认：

1. 初次GET抛错后history仍null、historyError为读取失败、loading false。不会生成total0或“无授权”快照。模板没有history时展示尚未取得快照，和真正读取到零证据不同。
2. 已读第2页后，第3页失败：仍保留page2、原observedAt，historyStale true、独立错误存在；不把旧页标成新页成功。
3. validHistory接受正确nullable证据及字符串9007199254740993；分别拒绝错误customerId、计数相加不匹配、hasActive布尔不匹配、错误页码、非规范ISO观测时间。计数为非负安全整数、pageSize20与页列表上限也在源码约束内。前端只渲染已定义证据列，不显示额外内部字段；完整字段白名单的权威约束仍由后端执行，不能把客户端校验称数据访问控制。
4. 客户10的grant保持pending，props切换11后真实watch清空旧草稿/结果、读取11；旧grant完成后仍customer11、result空、draft空、busy空。旧响应没有把客户10结果带入11。
5. 初次读取pending时触发卸载，随后旧读取返回：history仍null、error空。disposed及代际共同阻止卸载后的结果写入。
6. grant真实方法返回成功后，后续GET失败：result保留本次登记，草稿saved保留，旧observedAt保留、stale true、historyError存在，ElMessage写失败提示数组为空。读取失败没有被grant外层catch错误解释为写入失败。
7. 写前在途读取保持pending，grant成功后新读active1/total1；随后旧读返回active0，最终仍1/1和成功操作结果。开始写入时invalidateHistory确实使旧读取失效。

## 源码边界核对

所有read成功、失败和finally都有disposed/latestRead约束；write成功、失败、finally都有disposed/latestWrite约束。props watch先使旧write失效并清理历史/草稿再发新客户读取，onBeforeUnmount使两类请求失效。重试/分页固定受控参数，不从上次操作结果推算持久状态。API解析失败走读取错误，不生成默认空状态。

ISO函数先Date.parse再toISOString等值核对，实际后端返回UTC毫秒Z格式兼容；页面time datetime/title保留原observedAt，展示按本地时区附时区名称，不把观测时间写成实时同步。grant/revoke操作后固定刷新第1页；读刷新不修改证据输入。写失败后旧快照标stale，结果不被凭空更新。

组件移动到详情下方全宽仅改变布局。先前真实UI5场景已证明实际初读/写后刷新/撤回/分页大ID/双企业隔离/读取503保留状态；该报告是本轮独立脚本复核，不把那5例或作者17浏览器例再算成新执行。截图内部滚动问题已在独立UI报告如实记录并准备改进，非授权状态逻辑缺陷。

## 限制

本探针不完整挂载ElementPlus、路由或浏览器生命周期；它验证当前脚本中的实际响应式与异步逻辑，模板展示依据源码核对。真正跨企业数据隔离由既有后端SQL/网关HTTP证据承担。没有扩展为CMP、持续实时订阅、跨分页不可变快照或法律合规结论。当前未见值得阻断本切片的重要问题。
