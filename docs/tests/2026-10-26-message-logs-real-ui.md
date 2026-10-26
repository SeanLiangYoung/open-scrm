# 消息日志：模拟浏览器与独立真实链路证据（2026-10-26）

这是本地临时数据验证，不是生产验证或第三方送达证据。日志页 `/message-logs` 位于运营平台消息中心，只为 `messageType=5` 且 `sendStatus=2` 的记录提供人工重试。所有成功措辞均指日志结果；历史渠道状态不能证明真实送达。成功重试后后端保留原 failReason，所以页面列名为“最近失败原因”。

## 模拟 API 浏览器

`code/e2e/message-logs.config.ts`（端口 3113）与 `tests/message-logs.spec.ts`：实现前 14 个场景失败，实现后 **14 passed / 0 skipped，13.0s**。这些请求经过 Playwright 模拟，覆盖列表/展开原行数据、空列表、分页、状态 0、渠道 5、加载失败、单条安全数字 ID 重试、禁止成功/待处理/未接通渠道重试、不安全 bigint 禁写、业务失败、取消、零匹配和矛盾计数不冒充成功。该套件不证明服务端持久化。

## 真实 Chromium 链路

入口：`node code/scripts/test/overnight-message-logs-ui.cjs`。独立配置 `code/e2e/playwright.message-logs-ui.config.ts` 与 `tests/message-logs-ui.spec.ts`。脚本创建 PostgreSQL16、Redis7 临时容器，clean build/start auth/message/gateway，随机 loopback Vite 端口、严格端口占用检查；实际界面登录取得 token，没有 API 路由模拟或预注入 token。两个普通账号分别属于 1201/1202，6 条合成日志由 fixture 写入；这些记录不代表自然业务发送历史。无关服务统一转向自有 HTTP503 listener，尤其登录后看板的聚合请求不能触及其他本地服务。

最终 artifact：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-message-logs-ui-ONmtIK`。

- **4 passed / 0 skipped，7.6s**：A 企业失败 Mock 经实际界面确认重试、成功提示并刷新；B 企业看不到/不能通过伪造企业身份重试 A 日志；成功日志无按钮且直接重复请求返回 total0；未接通短信无按钮，直接负向边界请求返回 failed1。
- SQL 逐行断言保持原 6 条、无新增：62001 Mock 成功且 retryCount1/sendTime 非空；62002 成功记录与原时间不变；62003 待处理不变；62004 未接通短信仍失败、计数1且原因更新；62005/62006 跨企业保护记录计数0。内容/归属/渠道的关键值也受断言保护。未接通负向 API 重试允许更新已有失败原因/计数，不能解释为完全无写。
- 唯一成功执行的渠道是 Mock5。短信负向调用在 capability 校验处拒绝，没有真实消息或第三方送达。
- `result.json` 为 testsPassed/cleanup/passed 全 true；5 个自有子进程已退出、2 个临时容器不存在，无残留 listener。端口 PG49493/Redis49501/auth49544/message49545/gateway49546/Vite49547 均为本次自有随机端口。
- 正向截图 `playwright/message-logs-ui-real-faile-0351a-d-without-claiming-delivery/real-message-logs-mock-result.png` 使用 animations disabled，已人工查看，包含模拟不送达说明、记录成功和最近失败原因。

首轮实际验证 3 passed / 1 failed：新 spec 精确按钮名误写为“重试”，实际名称“重试模拟消息”；修正正向及负向定位后 fresh 数据重跑全绿。没有为此修改业务实现或延长超时。

本次页面文件及路由/布局 ESLint、运营平台 vue-tsc --noEmit exit0。前端 dist build 交由根任务串行总门禁；本报告不额外声称全仓库 build 或生产接通。失败截图/trace 启用保留；临时 artifact 不保证跨机器持久存在。

后续隔离审查发现启动失败时容器ID登记过晚及直接子服务入口缺少profile拒绝，已修正日志harness并以2项进程级故障/入口selfcheck验证；详见[三条业务harness审查](2026-10-26-business-ui-harness-review.md)。ONmtIK四场景属于修复前正常运行证据，新脚本正常链路需由根任务统一回归；本次自检没有额外启动真实服务。
