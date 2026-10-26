# 通知历史分页与未过期未读口径

实施依据[通知历史计划](../plans/2026-10-26-notification-history-navigation.md)。本页区分独立Mock浏览器、服务单测及实际UI执行证据，不改写此前ALL32或通知员工3场景的历史结果。

## 行为与红绿证据

NotificationCenter新增固定20条分页、全部/未读/已读筛选和服务返回总数。首次明确page1/pageSize20，未读isRead0保留，全部省略isRead。页码、筛选、列表与total只在最新有效响应时提交；失败保留之前已显示页。total必须为非负安全整数，page和offset必须安全；当前页因记录变动超出末页时最多纠正一次，防止空页死循环。沿用原发送草稿锁与列表/计数/loading/错误代次保护。

新增notification-history Mock配置使用3115独立严格端口。原页面准备阶段10场景全部失败；实施后加末页收缩、过期错误两项，最终 **12通过、0跳过，13.0秒**。覆盖分页20以外、isRead0/1/全部、标读保留筛选页、导航失败重试、3种非法total、乱序成功/错误、末页唯一行标读回退。

原notification-staff配置 **18通过、0跳过，24.8秒**。只同步带query参数的拦截glob和一个响应缺total的旧夹具，原6个并发保护断言未放宽。页面/新旧spec的ESLint与运营vue-tsc --noEmit通过；未抢占共享前端dist构建。

## 过期未读角标的后端最小修复

已确认原列表排除过期，但getUnreadCount只按用户/企业/isRead计数，导致不可见过期通知仍计入角标。新增notification-unread-expiry.spec.ts：红测 **4失败、1通过**；getUnreadCount改用与列表相同的数据库NOW到期条件，并保留userId/corpId/isRead0，之后 **5通过**。消息服务全量 **18文件197项通过**，tsc --noEmit通过。

角标现在表示“当前用户、本企业、所有未过期未读通知”，不随全部/已读/未读筛选或当前页变化。分页total表示当前筛选的未过期通知总数，两者不混用。单测使用仓库替身，真实过期行的SQL和API结果由下述独立链路核对。

## 实际UI准备与运行边界

入口 `node code/scripts/test/overnight-notification-history-ui.cjs`，实际Vite→gateway/auth/message→专用PG16/Redis，实际Chromium登录，无路由拦截或注入token。新增profile自检8组通过，非法direct--service拒绝且没有网络；守卫、专用数据库/身份、loopback拥有端口、容器create→记录ID→start及进程/容器清理沿用已验证模式。真实运行只在主任务独占窗口内执行。

夹具37条：A1拥有30条有效通知（25未读、5已读）以及2条已过期但仍未读记录；同企业A2有3条、企业B有2条。createTime不同以确定页序，过期记录时间较新，若漏掉过期条件将直接影响首页或角标，不能靠排序偶然隐藏。3实际场景目标：A1分页覆盖30可见ID且角标25；A2/B仅看到自己的3/2条且不能标A1通知；A1未读第二页标最旧一条后24未读/6已读、重新加载仍持久，过期2条始终不计角标且message_log为0。

以下最终记录来自该次脚本完成后的SQL、页面及清理核对，准备与最终证据分列。

## 实际UI最终证据

首次运行 `node code/scripts/test/overnight-notification-history-ui.cjs` 退出0，**3通过、0跳过，9.1秒**。第一页20/total30，第二页10，两个ID集合无重复且覆盖30条；未读筛选第2页5条，标记ID93125已读后同页4条、total24，切已读6条，重新加载后仍保持。全局角标在筛选全部、未读或已读时均为25→24，不等于筛选total6，也未错误计入2条较新的过期未读。

实际peer与foreign分别看到3/2条自己的记录；同企另一用户及外企用真实登录令牌标记A1已知ID均影响0行。PostgreSQL16.13最终分组：corp1/user1有效未读24、过期未读2、已读6；corp1/user93003未读3；corp902/user93004未读2。总数37未变，ID93125 is_read1且read_time非空，message_log=0。该SQL既证明分页标读持久化，也证明过期行仍存在而服务API明确不计入角标，并非测试删掉过期数据。

工件目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-notification-history-ui-NZXvrR`。result.json的testsPassed、cleanup.passed、passed全部true，errors为空；5个子进程及2个拥有容器已验证退出/消失，出站拒绝日志为空。database-evidence.txt与playwright-output.txt保留原始证据。共享窗口已明确释放。

真实截图已查看，fullPage、animations disabled，浏览器时区Asia/Shanghai：

- `playwright/notification-history-ui-ac-1d1d6-er-appears-in-badge-or-list/real-notification-history-page2.png`。
- `playwright/notification-history-ui-un-7cde4-badge-independent-of-filter/real-notification-filtered-read.png`。

本轮30个Mock通知用例（history12+原18）与3个实际UI场景分别统计；197个消息服务单测含本次5项过期回归，不能将这些数字相加宣称全为实际业务接口测试。没有真实第三方发送或生产部署；前端dist构建仍由主任务统一执行。
