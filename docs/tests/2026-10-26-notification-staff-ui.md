# 通知员工选择与真实接收闭环

依据[已选运营小闭环计划](../plans/2026-10-26-next-business-slices.md)的通知项。主任务26阶段复验结束后已释放源码；现已完成通知页面与独立契约回归。真实服务运行由主任务另行串行分配，本页分开记录两种证据。

## 预期行为与范围

通知表单不再默认用户1；复用已有TenantStaffSelect选本企业员工，允许多选与显式通知自己并去重。发送前把精确字符串编号严格转换为正安全整数，空收件人、空白标题、空白正文不写请求。后端拒绝停用/其他企业员工时，保留草稿和选择。发送成功后清空本次表单，下一次打开没有伪造默认员工。

通知列表和已读接口保持原有契约；标记已读/删除前校验通知编号安全，不能将bigint字符串舍入成另一个ID。未读计数加载失败保留上次值并明确反馈，不伪装为0或全部已读。不扩展分页、后端API、全局用户管理或外部渠道。

## 独立Mock浏览器与真实链路

Mock配置notification-staff.config.ts固定loopback3112、strictPort、禁止复用服务器。契约用例只验证请求/界面，不能视为实际数据库行为。

真实入口为 `node code/scripts/test/overnight-notification-ui.cjs`，使用专用PG16/Redis、实际auth/message/gateway、随机loopback Vite端口、实际Chromium登录。没有路由拦截或注入token；所有凭据通过实际登录取得。三个目标场景：同企业发送→同事实际登录读取并标记已读；另企业登录不可读取且按已知ID标记影响0行；选择员工后经专用隔离夹具将其停用→真实后端400且表单保留。

夹具用户9203为本企业启用同事，9204为902企业同事，9205为本企业停用员工；夹具通知92001用于跨企业标记边界。临时控制端点仅位于脚本持有的loopback监听器，需当前runId头，只能停用专用用户9203，不修改产品路由，也不连接现有数据库。最终预期SQL为两条通知（种子+一条界面发送且已读）、停用拒绝无新增、种子未读、message_log为0。

容器使用create→记录ID→start，清理只操作拥有ID并验证消失；子服务Bootstrap前TCP出站守卫仅允许脚本拥有的本地PG/Redis/HTTP端口，禁止真实提供方连接。其他网关依赖指向脚本持有的503端点，明确失败而非成功Mock。结果清单分开记录测试通过与清理通过，任一失败整体非零。

## 界面红绿证据

未改页面时首批9场景8失败、1个既有已读场景通过；补充空白正文、计数错误和超安全通知编号3场景均失败，总计11失败、1通过。实现后全量notification-staff配置12通过、0跳过，17.2秒。最后对ElementPlus checkbox使用用户可见标签点击，避免尝试点击其视觉隐藏input；未使用页面内部状态探针。

覆盖：空收件人、正确数值数组、目录重复与显式自选去重、超安全目录编号禁选、目录失败保留、后端停用拒绝保留、成功后重置、空白标题、已读刷新计数、空白正文、计数失败保留、超安全通知编号不写。两端员工选择器本体未修改；本项复用既有API与组件，不修改后端、路由或全局身份。针对本页面和两个新spec的ESLint、运营vue-tsc --noEmit及脚本node --check通过；没有单独抢占共享前端dist构建。

## 真实页面执行证据

执行 `node code/scripts/test/overnight-notification-ui.cjs`，首次真实运行退出0，Chromium **3通过、0跳过，8.9秒**。四次真实页面登录分别为发送者admin（两个场景）、同企业接收者notify_peer、902企业notify_foreign。发送请求两次：有效同事发送200、选择后停用发送400；已读写请求两次：接收者影响1行、其他企业按已知编号操作影响0行。发送前实际目录没有返回其他企业9204或停用9205。

PostgreSQL16.13最终精确结果：

- notification ID1：corp1、user9203、title=overnight-notification-peer、content=真实同事通知正文、is_read=1。
- notification ID92001：corp1、user9203、种子标题notification-foreign-boundary-fixture、is_read=0，跨企业操作未改变。
- notification总数2；overnight-notification-disabled-draft数量0；message_log数量0。
- 专用员工9203最终status0，证明停用发生在选择之后、提交之前；并未绕过服务端启用校验。

工件目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-notification-ui-NvLz0A`。result.json记录 `testsPassed:true, cleanup.passed:true, passed:true`，错误数组为空；5个拥有的子进程退出、2个拥有的容器消失。blocked-outbound.jsonl为空，未观察到超出拥有TCP端口的连接尝试。SQL与Playwright输出保留于database-evidence.txt和playwright-output.txt。共享服务构建窗口已释放。

正向截图均为真实页面、fullPage、animations disabled，已人工查看无裁切或遮挡：

- 发送表单：`playwright/notification-ui-real-emplo-76fb0--the-persisted-notification/real-notification-compose.png`。
- 接收者刷新后已读：`playwright/notification-ui-real-emplo-76fb0--the-persisted-notification/real-peer-read.png`。

截图时间显示遵循该隔离浏览器UTC运行环境；应用继续使用访问者浏览器本地时间，本项未修改全局日期语义。上述3项真实页面场景与12项Mock契约分别记录，不合并宣称为15项实际服务测试。此项没有第三方渠道送达或生产部署验证。

## 独立复核后的通知并发修复

后续[独立只读复核](2026-10-26-notification-ui-review.md)确认：发送pending时取消/重开可使旧成功清空新草稿；较旧列表/计数响应或错误能覆盖较新已读刷新。先新增6个真实浏览器受控响应场景，再修改页面：发送期间禁用表单、取消、叉关闭、遮罩/Escape关闭和再次打开；刷新代次同时保护列表、计数、列表加载状态与错误提示，旧列表完成后不再启动旧计数请求。

红证据分组保留：2个pending成功/失败、2个倒序成功（列表/计数）均失败；2个过期错误（列表/计数）通过等待响应结束及两帧渲染后即时检查toast数量，均失败。即时检查防止Playwright的重试等待错误toast自动消失后误认为从未显示；没有组件内部状态访问。

最新页面全量 **18个Mock浏览器用例通过、0跳过，26.5秒**；针对页面与spec的ESLint、运营vue-tsc --noEmit及差异检查通过。日志：`/tmp/notification-races-red.log`、`/tmp/notification-stale-error-red.log`、`/tmp/notification-races-green.log`。原有12个员工/通知正常与错误场景继续通过。

前述NvLz0A的3个实际UI场景与截图是在并发补丁之前取得的历史执行证据；本次补丁后没有立即重跑真实服务或构建，不能把该3项历史记录描述为最新并发分支的实际HTTP验证。最终统一回归由主任务在共享窗口释放后安排。

## 隔离脚本服务启动保护补充

独立审查指出：原服务子入口虽有Bootstrap前TCP端口守卫，但 `--service` 误调用可能继承用户环境。现已在加载Bootstrap和网络补丁之前加入专用profile校验：必须有NOTIFICATION_UI_DISPOSABLE=1；数据库用户/数据库/一次性密码均匹配脚本专用值；DB与Redis为127.0.0.1、规范1024–65535端口且非默认5432/6379、两者不同；服务只允许auth/message/gateway，监听端口必须来自当前拥有端口清单且不与DB/Redis共用；要求已有专用临时工件guard日志。父脚本显式设置标记，不依赖继承标记。

模块增加require.main保护，独立自检import不会启动容器或服务。create→记录拥有ID→start顺序保持。新增 `node code/scripts/test/overnight-notification-ui.selfcheck.cjs`，**8组通过、0失败**。其中3个实际子进程场景预加载TCP/DNS/fetch拒绝tripwire，分别验证缺profile、带marker但数据库用户不符、非允许服务，全部退出1，无连接尝试和父脚本工件启动；正向只调用纯profile校验，未启动服务。其余组覆盖loopback/默认端口/编号后缀、清单重复和工件缺失。

自检工件：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-notification-ui-selfcheck-NMIjbU`。本轮没有另跑正常真实UI或clean构建；主任务ALL32在HTTP阶段将使用加固后的脚本，其最终结果应以该次独立清单为准。
