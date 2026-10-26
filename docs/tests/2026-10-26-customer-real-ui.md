# 客户创建与跟进的真实浏览器验证

时间：2026-10-26（Asia/Shanghai）。这是实际 Chromium → Vite → gateway → auth/customer → PostgreSQL16 链路验证；客户及认证接口没有 Mock，没有注入登录令牌，没有调用消息服务。

## 复现

仓库根执行：

```bash
node code/scripts/test/overnight-customer-ui.cjs
```

脚本创建仅绑定 loopback 随机端口的一次性 PostgreSQL16、Redis 容器，等待 PostgreSQL TCP 就绪后应用完整初始化 SQL。重新构建并启动 auth、customer、gateway，在独立随机端口启动 Vite，设置 `VITE_GATEWAY_URL` 指向本次网关并要求 `strictPort`。浏览器通过实际登录表单取得身份。

为避免主页加载时误连项目已有服务，所有未参与验证的网关依赖均指向脚本拥有的隔离监听器，明确返回503；不会伪造成功的业务数据。这些主页模块未在本批验证。测试使用的登录、客户、跟进全部经过真实后端与数据库。

结束、异常及信号中断时，只清理本次创建的服务/Vite/测试进程、隔离监听器及容器；验证全部退出或不存在。清理失败会使总体结果失败。浏览器截图、实际 HTTP 附件、日志、数据库查询和最终结果 JSON 保存在脚本打印的临时目录。

## 三项浏览器结果

最新稳定代码上最终 **3/3 Chromium 测试通过**（原两项保留）：

1. 登录 → 客户管理 → 新建客户 → 点击新建客户进入详情 → 保存跟进 → 自动刷新时间线 → 整页刷新仍显示记录。创建请求只包含真实 DTO 字段，企业与操作者来自认证上下文。下次跟进时间在上海时区输入 `2026-11-02 09:45`，提交为 `2026-11-02T01:45:00.000Z`。
2. 另一专用客户输入空白跟进，实际后端返回400和 `content 必须为非空字符串`；页面保留原草稿、保持保存按钮可用，并允许继续编辑。没有为测试模拟拒绝响应。

3. 实际员工选择器请求 `GET /api/v1/staff`，只显示本企业启用员工；外企与停用夹具不出现。远程搜索选择“界面同事”，创建第二个客户时发送数字 `followUserId: 9103`，后端成功保存该归属。没有用前端模拟选项替代员工查询。

PostgreSQL **16.13** 实际查询与严格断言：

- 未分配的新建客户恰好1条，`corp_id=1`、渠道wechat、手机号正确、`follow_user_id IS NULL`；没有默认为员工1。
- 两个专用名称的新建客户总计恰好2条；第二条 `follow_user_id=9103`，与选中的本企业启用同事一致。
- 跟进恰好1条，属于该新客户和企业1，操作者是实际登录admin的ID；内容与方式正确，数据库时间为UTC `2026-11-02 01:45:00`。
- 空白草稿未写入任何跟进记录。
- `message_log` 行数0，无消息请求或外部发送。
- 最终结果 `testsPassed=true`、`cleanup.passed=true`、`passed=true`；全部自建进程和两只容器清理通过。

## 证据与限制

成功证据目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-customer-ui-QhgIlq`。`playwright` 子目录包含 `persisted-customer-follow-up.png`、`real-validation-keeps-draft.png` 、`real-active-staff-selection.png` 以及实际请求/响应 JSON 附件；`database-evidence.txt`、`playwright-output.txt`、`result.json` 保存查询、执行和清理证据。临时文件可能被系统清理，可使用上述命令重跑。

这是客户创建与跟进的窄范围真实浏览器验证，不证明未启动的主页统计/SOP模块可用，也不涵盖全部客户编辑、CSV导入导出、全平台权限或真实经营效果。当前员工选择已纳入第三项实际验证；后续功能变动仍需在代码稳定后重跑。
