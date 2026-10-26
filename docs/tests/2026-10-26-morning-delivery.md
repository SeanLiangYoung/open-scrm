# Open SCRM 夜间交付与中断记录

收口核查：2026-10-26 09:51北京时间。约04:21三个并发执行者均被账户usage limit终止；其后自动唤醒未产生可证明的开发进展。未按08:00及时交付，不能将该时段称持续执行。现已删除open-scrm续跑，停止扩展。

## 已有实际证据

- 04:12无缓存全库单元：82文件1086项，17任务成功，0缓存；/tmp/open-scrm-unit-force-final-integrity.log。该快照早于M25–M27修改，不证明当前全部源码通过。
- 最新独立Mock浏览器：14阶段全部通过，0失败0跳过；/tmp/open-scrm-browser-14-current/manifest.json，175项模拟API用例，不是实际后端联调。
- 七组工具安全检查通过，0失败；/tmp/open-scrm-business-harness-safety-seven-repeat.log。实际Docker create/start失败清理、无profile拒绝，未启动数据库服务。
- 历史all32完整通过；all40为39通过1工具失败0跳过，保留原失败。注册扩展50阶段，但最新all50没有执行，绝不标记通过。
- 客户、标签、消息模板、SOP、通知、授权读模型和观测趋势的分层独立证据见overnight-verification及各专属报告。

## 尚未验收的当前工作

M25扫码事务计数/持久幂等、M26内容路径与bigint批推、M27管理员密码/角色/路径：源码/测试/迁移已部分落盘，子任务因额度中断，根未完成最终复核与完整验收。此前子任务反馈的局部绿色不替代当前全库结果。新增channel_scan_event初始化与独立迁移仅写文件，没有施加于既有数据库。恢复后先审查这些未完成改动及迁移，再跑服务单元、类型检查、隔离PG并发/故障和最新50阶段。

## 资源与边界

收口查询没有带open-scrm.verification标签的运行容器，也没有overnight/verify-reliability/playwright实际测试进程；现有scrm-*业务容器未停止或修改。378项工作树状态包含既有及本夜修改，全部保留，没有reset/stash/提交/远程推送/部署/真实渠道发送。真实渠道1–4仍未接通，Mock5成功不代表送达；SOP仍有进程内调度限制，远程CI未执行。

主计划：../plans/2026-10-25-overnight-execution.md。完整历史证据：2026-10-26-overnight-verification.md。
