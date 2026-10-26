# 夜间执行：首轮进度与证据

这是首轮执行快照，**不是次日早晨的最终交付**。权威任务和后续队列见 [夜间执行计划](../plans/2026-10-25-overnight-execution.md)。执行窗口是北京时间 2026-10-25 晚至 2026-10-26 08:00。

## 首轮门禁

主执行者实际运行：

```bash
cd code
PATH=/tmp/open-scrm-tools:$PATH TEST_REPORT_DIR=/tmp/open-scrm-overnight-final-gates pnpm test
```

`/tmp/open-scrm-tools/pnpm` 指向本机已缓存的 pnpm8.9.0，与 packageManager/锁文件版本匹配。当前运行环境默认 pnpm 不匹配，不能据此自动删除依赖或重写锁文件。其它环境使用正常安装的 pnpm8.9.0 即可。

输出为 **8 个门禁通过、0 失败**：单元测试、四个共享包构建、全库类型检查、已配置包 lint、全库构建。逐项输出在 `/tmp/open-scrm-overnight-final-gates/check-1.log` 至 `check-8.log`；完整摘要 `/tmp/open-scrm-overnight-full-test.log`。本机临时日志可能被清理，核心结论记录在此。

单元测试当轮为 **51 个文件、250 项通过**，其中部分包从 Turborepo 缓存重放。它证明当轮快照的检查通过，后续修改必须重新验证。lint 实际运行在声明了 lint 脚本的 gateway/auth/admin/operation-platform 四个包，并不代表所有服务源码都已通过相同规则检查。前端构建仍有较大分块提示，未把提示隐藏或当作运行时故障。

随后主执行者用 `turbo run test --force` 对同一单元范围重跑，**17/17任务成功、0缓存，51文件/250项通过**，日志 `/tmp/open-scrm-overnight-unit-force.log`。

全库 lint 初次排除生成文件后仍有 560 个错误/45 个警告；后续按既有规则修复格式、未知错误收窄、视图类型和空异常处理，未通过关闭规则或忽略源码来制造通过。

## 实际数据库验证

主执行者实际重跑 `bash code/scripts/test/overnight-customer-postgres.sh`，退出0，在全新 **PostgreSQL16.13** 上通过 **24项具名检查**。包括完整初始化、迁移重复两次、实际 TypeORM 操作、身份来源、跨企业拒绝、污染数据过滤和输入拒绝后的精确行数。

详见 [客户 PostgreSQL 报告](./2026-10-26-customer-postgres.md)。这部分使用真实数据库和直接控制器调用，不能标为 HTTP 网关 E2E。脚本仅创建并删除自己的临时容器，主执行者重跑后确认无该标签容器残留。

## 已实现的业务改进

- 客户跟进输入校验、日期/分页边界及企业过滤；当前服务55项单测。
- SOP 长延时避免 Node 定时器溢出；暂停/恢复控制不覆盖控制状态；旧 worker 拒绝后能重建恢复链；模板步骤读取和替换验证企业归属，写入使用白名单。
- 同意授予与撤回 API；同一客户的写入通过事务行锁串行化，撤回全部有效授权，后续声明营销目的的发送被拒；当前消息服务64项单测。
- 网关保留 `Idempotency-Key`，并回归验证身份头只来自认证状态；gateway6项单测。
- 完整测试入口现在保留各检查日志并显示原失败退出码；通过模拟 lint 退出23验证最终仍跑完8项且返回失败。
- CI 配置增加 lint/构建以及隔离业务链作业、失败证据归档；尚未推送运行，**未宣称远程CI通过**。

## 正在继续

1. consent 真实 HTTP 已由主执行者重新跑完，**1通过/0跳过**；清理退出码、子进程退出和容器消失均验证。最终主执行者证据目录 `open-scrm-consent-http-cxDLcQ`（系统临时目录下）。一次独立重跑暴露PG初始化阶段短暂就绪问题，改为容器内TCP探测后通过。现在扩展第二企业真实登录的HTTP对抗验证。
2. SOP 步骤事务化已完成，主执行者真实PG16脚本**5项通过**；客户/SOP脚本清理故障注入均正确退出1，不再掩盖清理失败。
3. 运营前端浏览器回归与发现的标签/SOP请求形状问题；类型检查通过不等于业务流程已验收。
4. Sprint事实同步已完成；新增客户跟进真实HTTP链、扩展用例后的CI入口同步、最终全回归与早晨收口继续推进。

当前修改保留在原分支和工作树，没有提交、远程推送、部署或真实消息发送。新建数据库仅作隔离验证，没有写入原业务数据库。

## 23:22续跑复验

主执行者实际执行以下两项（均退出0且 `result.json` 中 `testsPassed`、`cleanup.passed`、`passed` 为true）：

- `node code/scripts/test/overnight-customer-http.cjs`：1项测试、8具名步骤、24次业务HTTP请求，两个企业通过真实登录取JWT；合法跟进创建/列表、双向跨企业404、匿名401、非法输入400、身份伪造抵抗，SQL精确4条夹具记录。证据临时目录 `open-scrm-customer-http-CIWAK2`；[详细报告](./2026-10-26-customer-http.md)。
- `node code/scripts/test/overnight-consent-http.cjs`：2项通过、0跳过，原授权撤回闭环加第二企业真实登录；双向外国客户授权/撤回404、营销发送403、伪造身份头无效；SQL精确4条已撤回授权和3条正确企业Mock发送日志。证据临时目录 `open-scrm-consent-http-rjwWDQ`；[详细报告](./2026-10-26-consent-http.md)。

运营前端首批6项真实Chromium/模拟API请求契约用例由子任务运行通过；主执行者等待新增跟进和看板用例后统一重跑。CI新增customer-http以及独立浏览器检查作业，YAML语法可解析；远程CI没有执行证据。
