# 三条业务真实 UI harness 只读复核（2026-10-26）

范围：`overnight-notification-ui.cjs`、`overnight-customer-consent-ui.cjs`、`overnight-message-logs-ui.cjs`，对应 runtime spec/config、事实报告及保留 artifact。此次只读取文件与既有证据，**没有启动服务、容器、浏览器或构建，没有修改业务或 harness 源码**。这不是一次新的运行验证。

## 需要修复的失败路径

### P2：授权与日志容器启动失败可能绕过资源登记

`code/scripts/test/overnight-customer-consent-ui.cjs:111`、`overnight-message-logs-ui.cjs:100` 使用 docker run，再在命令成功返回后 push ID。若 daemon 已创建资源但启动或响应返回失败，command 抛错时 ID 尚未进入 ownedContainers，finally 不能依据该 ID 清理；即使正常执行 artifact cleanup=true，也不能证明该失败分支无残留。

通知脚本已经采用 create→登记 ID→start（112–115 行），可作为统一实现方式。建议剩余两条也先 create 登记再 start，并为启动失败路径增加不依赖真实业务服务的回归。当前只读阶段没有改动或复现故障，也没有观察到历史运行残留。

### P2：日志直接子服务入口没有 disposable profile 校验

`overnight-message-logs-ui.cjs:15–20` 可直接 `--service <name> <port>` 执行 Bootstrap，数据库/Redis 配置完全继承环境。正常 main 对 DB_HOST/PORT/USERNAME/USER/PASSWORD/DATABASE 和 Redis host/port 全部覆盖为自有容器，因此本次 ONmtIK 正常执行证据没有显示连接用户数据库；风险在于将内部模式直接当入口使用时，可继承真实项目配置，缺省甚至落回 scrm_dev。

建议对子模式先验证固定专用 DB profile、loopback、非默认端口及服务白名单，再 Bootstrap；授权脚本已有这一层（15–26 行）。通知脚本会在缺少 NOTIFICATION_ALLOWED_PORTS 时先解析失败，且 TCP 只允许给定自有端口，防护比日志强；但该白名单是外部传入环境，尚非完整 DB profile 证明。不可把三条脚本都描述为“任何直接子进程启动都可证明拒绝用户 DB”。

## 正常隔离与清理核对

三条 main 均新建 PG16/Redis 容器、loopback 随机发布端口，无用户数据卷挂载；psql 总是 docker exec 到已登记的专用容器。读取 init-db.pg.sql 只用于初始化临时库。服务环境明确覆盖数据库和 Redis，Vite 的 VITE_GATEWAY_URL 指向自有随机 gateway；所有无关 gateway 服务 URL 指向脚本持有的503 listener。看板会尝试 POST aggregate-daily，但该请求落在自有503 listener，不能写现有 analytics。

通知唯一可变 fixture HTTP 端点是 loopback `/__fixture/disable-notification-peer`，要求当前 runId 头，SQL 固定只改本次专用库 corp1/user9203；不接收任意 SQL、用户编号或目标地址。其余路径明确503。授权/日志 listener 只有503，无成功业务响应伪造。通知子服务的 TCP 守卫在 Bootstrap 之前安装；它不是完整 DNS/UDP/子进程网络隔离，报告当前准确限定为 TCP。另两条未安装通用网络守卫，安全范围依赖显式 Mock5 和当前 capability 拒绝；不能外推为未来任意 SDK 出站都被底层阻断。

三条 cleanup 都先终止自己 children、等待、必要时强杀，逐个核对进程退出；移除自己登记的容器并核对 docker ps 不存在；关闭自有 listener 和日志文件。cleanup errors 会令 cleanup.passed=false/总 passed=false，并在 finally 抛错给顶层非零退出；测试通过不能掩盖清理失败。SIGINT/SIGTERM 也保存结果并非零退出。上述登记前失败窗口除外。这里只核对已记录直接子进程，未对任意可能脱离父进程的后代建立独立清点证明。

## 既有证据与截图准确性

实际读取三个目录的 result.json、database-evidence.txt 和截图文件列表：

- 通知 `open-scrm-notification-ui-NvLz0A`：testsPassed/passed/cleanup.passed 全 true，errors 空；两个实际截图文件存在。SQL 恰两条通知（UI 创建1已读、种子92001未读），停用草稿没有插入，9203最终停用，message_log=0。对应报告标明后续并发补丁尚未重跑实际服务，不能把历史3项当最新并发分支的真实证据。
- 授权 `open-scrm-customer-consent-ui-DjiECM`：上述布尔均 true，errors 空；A9001撤回/B9002有效，各一条证据，恰一条 corp1/target9001/Mock5 成功日志。**该目录没有 PNG**；报告明确说明截图是在当次清理后才新增到 spec、尚未执行，表述准确。不能交付为已有授权正向截图。
- 日志 `open-scrm-message-logs-ui-ONmtIK`：上述布尔均 true，errors 空；截图实际存在并已人工查看，模拟不送达、记录成功、最近失败原因均可见。SQL 原6行：Mock62001成功/计数1；62002原成功时间与计数保持；62003待处理；62004仍失败但计数1/原因更新；62005、62006未重试。SQL对关键行检查部分字段，保留 evidence 显示其余字段；这不是对每一列的全行不可变断言，不应声称所有字段均经自动严格比较。

三个配置都保留失败 screenshot/trace；正向截图显式 animations disabled。临时文件存在仅证明当前机器保留，不代表 CI 上传或长期归档。

## 界面操作与直接 API 的边界

通知：发送、接收者已读均真实 UI；跨企按已知 ID 标记是 page.request 直接 PUT，目录选好后停用为专用 fixture POST，随后失败提交才是 UI。不得声称 UI 提供跨企通知或员工停用入口。

授权：登记/撤回/重复撤回为真实 UI；登记后的 Mock 营销 send、撤回后403、跨企伪造 grant/revoke 都是 page.request 直接调用。这验证“UI 产生证据→实际服务闸门”链路，不是页面上的营销发送功能。

日志：仅首例失败 Mock 经确认按钮执行 retry；B跨企、成功历史重复以及未接通短信负向 retry 都是浏览器 fetch 直接接口调用。页面明确不提供后三种按钮。短信负向可以更新原 failReason/retryCount，不能描述为日志整行完全未写；它没有成功发送或新增日志。

结论：正常执行证据与报告主要一致，可保留为本地隔离历史事实；上述两项失败路径应在下一次扩展或作为通用可复用入口前修复。没有据此证明生产部署、法律合规或第三方真实送达。

## 日志 harness 复核后修复（根任务追加授权）

只读审查完成后，根任务明确授权只修日志 harness；其余业务/脚本保持冻结。日志现改为 create→登记 ID→start；子服务 Bootstrap 前要求 MESSAGE_LOGS_CHILD_DISPOSABLE=1、固定专用 DB 用户/数据库/密码、loopback PG/Redis、有效非默认数据库/Redis端口、有效服务端口及 auth/message/gateway 白名单。正常 main 显式传入 marker。

新增 `code/scripts/test/overnight-message-logs-ui-selfcheck.cjs` 不启动真实 Docker daemon/Bootstrap/数据库/HTTP：以 VM 对 Bootstrap 加载设探针，并以 PATH 下专用 Docker 替身对子进程 start 注入42。修复前实际运行两项均 RED；修复后2项均 PASS，Docker start故障使整体exit1，已create容器ID被rm并核对ps为空，result.testsPassed=false/passed=false/cleanup.passed=true。故障工件 U6mXJk。这里是进程级 Docker CLI 替身故障注入，**不是宣称真实 daemon 发生启动故障**。

另实际 Node子进程在清空环境后执行 --service auth-service 49123，exit1，报拒绝专用disposable profile；不加载Bootstrap、不连接用户数据库。日志脚本node --check通过。修复后的正常真实4场景尚待根任务统一重跑，旧ONmtIK仍为修复前正常路径历史证据。授权脚本的登记顺序缺口仍未在本任务修复。
