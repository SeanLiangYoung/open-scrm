# 已存日表趋势：实现与分层验证（2026-10-26）

对应[设计计划](../plans/2026-10-26-observed-dashboard-trends.md)，只读投影与运营Dashboard已实现。无生产部署、无第三方发送、无收入归因。本报告分开记录模拟API、真实HTTP/浏览器与后续身份修复快照，不把它们混为一次测试。

## 实现契约

新observed-daily controller/service/util只对本企业daily_stat做一次参数化SELECT，严格实际日历、闭区间最多31天、未知字段400。完整canonical正安全corp/user必需，缺失/畸形401，任一身份header出现后不能借state补齐；旧legacy helper未修改。身份来自可信网关或完整认证state，不能将服务直连头本身等同JWT。

完整日历每天一项，无行全null，真实0保留；无采集时间的旧行仍已存。日期计算用UTC避DST，事件历史时区未知且显式null；库存按updateTime采集时刻解释，不是历史收盘状态。消息/SOP是创建记录数量，消息包括模拟/历史状态，不承诺送达；不返回完成事件、收入或流失事件。

Dashboard保留最近最多100客户样本图，新事件/库存分图、connectNulls=false和可读日表；含缺测天数、空/错误/旧数据提示及完整日期/采集时间tooltip。读取时删除隐式聚合POST；日表缺失不自动写库。新图ECharts animation=false，避免截图时JavaScript动画尚未结束；Playwright animations disabled仍用于页面CSS。

## 测试前后证据

- 新util/service源文件不存在时，两套测试先失败；实现后17项通过。SQL只读断言起初把update_time字段误匹配为UPDATE，修成SQL关键字边界后通过，未改SQL规避断言。
- 浏览器首版误用不存在的/dashboard路由，此轮不计作功能红证据。纠正为/后，在缺新区域模板上重新执行8项全部失败；倒序响应补充用例也单独失败。最终9项全通过、0跳过，8.0s。两项Select点击曾命中视觉覆盖input，改成可交互外层后通过，未force点击或延长超时。
- 独立审查发现新controller初版沿用legacy identity helper会默认corp1/宽松parseInt。新增14项controller测试先12失败/2通过，修正为严格身份后14通过；完整analytics **8文件52项通过**，含新增31项。analytics tsc --noEmit exit0。
- 新Dashboard ESLint和运营vue-tsc --noEmit通过；既有operation-contracts配置 **25 passed，20.6s**，旧spec未修改。新脚本node --check/diff-check通过。前端dist build由根任务统一窗口安排，本段不声称已单独build。

Mock入口 `code/e2e/observed-dashboard.config.ts`（严格端口3116），对应 `tests/observed-dashboard.spec.ts`。9项覆盖只读请求/受控日期、null与0、旧无时间、语义和样本标签、14日、全缺、读取错误、倒序响应。模拟响应不证明数据库行为。

## 首次隔离真实执行（严格controller身份补丁之前）

入口 `node code/scripts/test/overnight-observed-dashboard-ui.cjs`；专用 `observed-dashboard-runtime.config.ts`/`observed-dashboard-runtime.spec.ts`。新PG16/Redis、实际auth/analytics/gateway及Vite，两个普通企业用户真实登录，无API拦截/预注入token。所有无关服务指向本脚本持有的503 listener；读取数据来自临时库，不连接用户数据库。

夹具为五条**合成**daily_stat：A跨年12/31实测0且无采集时间、1/1缺行、1/2非零且采集时间在10月；B仅1/1非零；另A当前浏览器日期实测0、前两日非零，中间缺测。为模拟旧行，仅临时库放宽update_time NOT NULL。历史夹具不是自然聚合过程或生产采样。

真实HTTP6项：匿名伪造头401；完整跨年缺/0；旧无时间和库存采集时刻；普通B用户隔离且伪造A头无效；多种非法窗口400；31日及公开字段白名单。真实UI2项：实际登录展示null/0/采集说明；选择14日保持完整日历和只读。UI登录之外不发API写请求。

首次 artifact `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-observed-dashboard-ui-qaC3KH`：**8 passed（HTTP6+UI2）、0跳过，8.0s，exit0**。database-before.txt与database-after.txt保存daily_stat/customer/message_log/sop_execution逐行全部字段JSON，脚本assert完全相同；result.readOnlySnapshotIdentical=true。不把认证可能更新的user字段包含在这个只读表集合声明内。

result.testsPassed/cleanup.passed/passed均true，errors为空；自有5个子进程退出、2个临时容器移除，listener关闭。容器先create立即登记再start，子服务需固定专用profile/marker、loopback非默认DB/Redis端口与服务白名单。端口PG58756/Redis58763/auth58782/analytics58783/gateway58784/Vite58785。

该次正向截图已查看：`playwright/observed-dashboard-runtime-bd8e7-dzero-with-snapshot-caveats/real-observed-dashboard.png`。实际页面因无关503依赖显示其他卡片加载错误，符合隔离范围；第一张截图时ECharts动画尚未结束且滚动容器只显示上部，不应将其当全部精确点值截图。之后给新图禁动画，并在spec追加滚动到日表的第二张截图。**严格身份补丁、新图禁动画与第二张截图尚不属于qaC3KH执行快照**，等待根任务独立最终复验，不将历史8项冒充最新源码测试。

## 限制

日表缺采集来源审计，observed只指行存在，不能鉴别种子/导入/自然采集。库存不做历史重建，消息/SOP成功率不在此切片。事件分桶时区未知，不因测试使用UTC就修改历史解释。root最终统一回归/独立实际复验的结果另行补入，不擅自加到当前已执行数量。
