# 客户营销授权只读快照实际UI验收

状态：独立脚本/config/spec准备完成，尚未执行真实服务或前端构建。后端原生HTTP14组与MVCC PG6组是独立后端证据，不计为本UI验证。

新增consent-read-ui.config.ts及spec5例，真实登录与Vite界面：A零状态→登记证据后刷新1条；撤回后active0/revoked1及重复撤回0；22条旧nullable证据的分页和9007199254740993精确显示；B自己登记/读取而伪造A头读取A404并核对响应白名单；另一客户写成功后注入一次读取503，页面保留操作成功、草稿、旧observedAt和过期提示，故障解除后实际刷新读到新增证据。

新overnight-consent-read-ui.cjs使用新PG16/Redis及真实auth/customer/message/gateway/Vite，不改当前backend/UI源。全部成功响应真实转发gateway；唯一503由专用loopback故障代理对客户9003的GET发出，不伪造成功或授权状态，控制接口仅有一次性key的本地测试进程可用。报告必须明确该故障注入，不能称所有网络响应都来自后端。

SQL预期25专用证据：A9001一条已撤、B9002一条有效、A9003一条成功但当时读失败的有效证据、A9004旧22条（有效12/撤回10），消息0。create后立即登记再start；所有子服务有专用profile guard；故障代理、排除依赖listener、浏览器/Vite/服务、PG/Redis均在最终结果前清理并确认。新cleanup自检已准备但未运行。

该脚本测试已有授权证据登记/撤回和读取快照，不创造客户实际同意、不代表法律合规；本轮不调用任何外部发送提供方。

## 实际运行完成

Node20.20.0独占四服务构建与真实Vite，五场景首次全部通过、exit0。A初读零→登记后active1，撤回后active0/revoked1、重复撤回0；旧22条证据按20/2翻页，实际9007199254740993字符串和未记录字段可见；B登记/读自己证据且伪造A身份头读A404、返回字段白名单精确；第五例真实grant成功后，唯一明确GET503故障让界面保留成功结果、草稿、原observedAt和旧快照提示，恢复真实读取后active1。

最终SQL专用客户共25证据：9001企业1 total1/active0/revoked1；9002企业2 1/1/0；9003企业1 1/1/0；9004企业1 22/12/10。消息0行。唯一故障记录是客户9003的GET?page1&pageSize20返回503，没有伪造成功数据。

证据 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-consent-read-ui-Jx6FLS/result.json`：browserCases5、expectedEvidenceRows25、expectedMessageRows0、testsPassed/cleanup.passed/passed true，exit0。PG56548、Redis56585、auth56602、customer56603、message56604、gateway56605、Vite56606、faultProxy56827。六自有进程15058/15103/15128/15146/15152/15154退出，两个容器不存在，故障代理及排除依赖listener均关闭。

启动故障自检check-consent-read-ui-cleanup.cjs实际通过：注入docker start非零，业务脚本exit1，cleanup true，唯一create容器f199ab9b1d6a7a6f922d9978ed0fd91da7b90db5e995b227bf76861c6c21b2be确认不存在，child0，缺profile直接启动guardexit1。证据`.../open-scrm-consent-read-ui-8PUYKv`。

截图已产出但目视检查发现layout内部滚动区使最初fullPage截图仍停在详情顶部，不能将其称为可读全表截图。已修测试截图步骤：滚动到快照，旧22行截图升高至1600×2000再滚动，供下一次根独立复验；这一截图增强尚未重新运行，不为截图重建环境。五功能场景通过证据不受截图裁切影响。
