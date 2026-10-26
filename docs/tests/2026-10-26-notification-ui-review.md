# 通知中心独立只读复核

2026-10-26；审查NotificationCenter.vue、TenantStaffSelect、useTenantStaff、notification-staff.spec.ts现12例及实际通知controller。未改产品源码、未构建、未启动HTTP，不占用作者正在运行的真实验证环境。以下两项通过内存转译当前Vue script并使用实际Vue响应式对象的独立探针复现，API仅为可控deferred Promise，无真实发送或数据库。

## 1. 待发送请求成功会清空重新打开的新草稿

位置：NotificationCenter.vue第199至207行showCreate无条件重置表单；第235至249行等待发送完成后无条件清空表单并关闭对话框。发送时只有发送按钮loading，取消、关闭及页面发送通知入口均未限制，也未绑定草稿/对话框版本。

复现：填草稿A并发送，API保持pending；取消对话框，再点发送通知并填写草稿B；A成功返回。实际探针输出newDraftTitle为空字符串、dialogVisible false，B未发送却被清除并关闭。用户在同一待发送对话框内修改表单也缺少保护。submitting同步guard已防第二次网络提交，但不能防旧回调破坏新草稿。

建议最小修复：发送pending期间禁止取消、叉关闭、遮罩/Escape关闭、重开并冻结证据输入；或者把请求和草稿代际绑定，仅当前草稿响应才能清空/关闭。新增一例延迟POST的浏览器回归，明确新草稿不能被旧成功丢弃，保留现有失败草稿用例。

## 2. 并发刷新可由旧列表/计数覆盖新状态

位置：fetchNotifications（约139至158行）无请求版本，列表和未读数顺序请求并直接赋值；markRead、markAllRead、deleteNotify和发送成功都不等待地触发新刷新。

复现探针：并发调用当前fetchNotifications两次，后发刷新先返回isRead true/count0，先发刷新随后返回旧isRead false/count1；最终界面状态为false/1。真实触发可由连续标记两条通知引起两次刷新，旧查询快照的响应更晚到达，页面便把实际已读通知重新呈为未读。loading也可被旧请求finally提前清除。不是数据库写回错误，是可见读取状态倒退。

建议最小修复：按刷新代际约束列表、计数、错误提示与loading的所有赋值，过期响应全部忽略；或串行统一刷新。补倒序响应浏览器例，验证最后一次请求获胜且未读数与列表不被旧响应覆盖。保留现有计数加载失败时不置零的行为。

## 已确认保持的边界

没有假默认员工：新表单userIds为空，includeSelf默认false。员工来自租户目录；显式自己也由当前身份取得，numericStaffIds去重且严格正安全整数转换，空或超安全编号不提交。通知标记和删除同样用safeStaffNumber拒绝舍入ID。搜索有latest版本检查，失败清空当前搜索结果并保留已选缓存标签和草稿；未发现新搜索旧响应覆盖问题。最终员工启用/企业归属由已有后端事务再次核验。

发送同步submitting guard防连续点击重复POST；正常HTTP错误走errorMessage且不清草稿，成功才重置。现后端实际create契约成功返回事务创建结果，失败抛状态码，本轮未把不存在的200失败契约设为缺陷。列表/计数失败会提示，计数失败保留最近已知值；现12例覆盖这些正常/错误路径，但没有延迟发送重新打开和倒序读取竞态。

未把本复核称为运行过12浏览器测试或真实通知闭环；当前真实窗口属于作者。没有修改共享operation README，后续事实收口由主执行者统一。

## 修复后独立验证

作者采用待发送期间冻结交互及刷新代际方案后，独立重跑当前Vue脚本探针：旧列表在新列表之后返回，最终仍isRead true、unread0且只发出最新计数请求；旧未读计数9在最新0之后返回，最终仍isRead true/unread0。

额外在Chromium的about:blank中内联加载仓库当前Vue与ElementPlus2.13.2浏览器包、当前NotificationCenter模板和脚本（无HTTP服务/请求），保持发送Promise pending。实际DOM确认标题输入disabled true、取消disabled true、顶部发送入口disabled true、关闭按钮数量0；按Escape并点击遮罩后对话框仍可见。实际showCreate函数在pending时再次调用不会重置，title仍pending draft。此探针只把目录子组件替换为静态占位，原表单控件、对话框和相关事件均使用当前真实ElementPlus，未冒称完整员工选择器浏览器回归。临时复现脚本 `/tmp/open-scrm-notification-review.cjs` exit0。

据此，上述两个已复现竞态在当前UI交互边界内已验证修复；本次不改源码、不build、不启动实际HTTP。作者报告的18项浏览器完整回归未在本复核重复执行。
