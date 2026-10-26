# SOP路径编号真实HTTP回归

承接[路径编号计划](../plans/2026-10-26-sop-path-identifiers.md)。本轮只修改现有[operation-http.spec.ts](../../code/e2e/tests/operation-http.spec.ts)，不修改后端、隔离脚本或前端。现有脚本仍运行5个测试，在立即执行SOP测试中新增独立test.step。

新增边界步骤发送23个HTTP请求：3种非法编号（真实模板编号加junk、加.5、9007199254740993），分别执行PUT模板、DELETE模板、GET模板和GET步骤，共12个400断言；每次非法PUT/DELETE后立即读取原模板，共6次完整快照相等断言；另有基线GET和4个合法控制请求（PUT原模板、GET步骤、POST临时草稿、DELETE临时草稿）均要求200。基线和6次回读确认原模板、步骤及时间字段均未被非法写改动。

用例继续通过真实登录、网关、operation/message服务和独立PG16；所有发送均明确使用Mock5，不调用第三方渠道。新增临时草稿只用于合法删除控制，不触发执行或消息日志。原有SOP执行随后仍须完成，因而错误删除原模板会使后续执行失败。

执行 `node code/scripts/test/overnight-operation-http.cjs`，退出0，Playwright **5通过、0跳过，3.7秒**。新增23请求步骤已在这5个用例内执行，不将步骤重复统计为独立用例。全部12个非法请求返回400，11个成功控制/快照请求返回200，6次原模板完整快照一致。

数据库为独立PostgreSQL16.13：1条完成的Mock群发任务（2成功、0失败）；4条SOP执行（立即完成1步、延迟取消0步、群SOP完成2步、注入失败0步）；严格断言消息日志总数5，全部corp1、Mock5、发送成功，其中客户目标3条、群目标2条。另1次受控HTTP200 failed-count响应没有产生新消息日志。该受控响应是明确的下游故障替身，不是第三方送达证据。

工件目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-operation-http-HKHEMi`。result.json记录 `testsPassed:true, cleanup.passed:true, passed:true`，清理错误为空；脚本确认5个拥有的子进程退出、2个独立容器消失。database-evidence.txt和playwright-output.txt保留SQL与执行证据。共享构建窗口已释放。
