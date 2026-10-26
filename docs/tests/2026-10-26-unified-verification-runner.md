# 统一可靠性验收入口

实现依据：[运行就绪计划任务3](../plans/2026-10-26-runtime-readiness-and-verification.md)。入口只编排既有已验证命令，不另行实现业务测试，不自动安装或下载依赖。默认从操作系统临时目录创建独立报告目录。

```bash
node code/scripts/test/verify-reliability.cjs --help
node code/scripts/test/verify-reliability.cjs --group static
node code/scripts/test/verify-reliability.cjs --group browser --report-dir /tmp/scrm-browser-review
node code/scripts/test/verify-reliability.cjs --group database
node code/scripts/test/verify-reliability.cjs --group http
node code/scripts/test/verify-reliability.cjs --group all
```

省略 `--group` 等价于 `all`。`--report-dir` 可以指定新目录；若目录已有 `manifest.json`，入口拒绝覆盖。未知参数、重复组/目录参数、缺失值或未知分组退出2。运行前需协调共享服务构建和真实HTTP任务，避免其他任务删除正在运行的服务dist；入口内部始终串行执行。

## 当前注册阶段（50，待最新全量验收）

- static 4阶段：全库八门禁、登录store竞态10项、响应竞态16项和编排器自检14项。
- browser 14阶段：原operation、mass-task、customer-form、staff-selection、两端tenant-login、sop-message-capabilities、notification-staff、message-logs、customer-consent，加notification-history、customer-consent-history、observed-dashboard、tag-integrity；独立Mock合计175项，不充当真实服务证据。
- database 10阶段：原customer、sop、analytics、customer-assignment、notification、service-schema-audit六项，另consent-read-postgres、tag-integrity-postgres、tag-name-concurrency、sop-create-postgres。
- http 22阶段：customer-http、consent-http、operation-http、staff-http、message-retry-http、message-capability-http、analytics-http、customer-ui、tenant-login、notification-ui、message-logs-ui、customer-consent-ui、notification-history-ui、consent-read-http、consent-read-ui、observed-dashboard-ui、tag-integrity-http、message-template-http、sop-action-http、notification-identifiers-http、customer-input-http，以及runtime-boot显式OSS夹具。

精确命令与依赖以[注册表](../../code/scripts/test/verify-reliability.cjs)为准。所有数据库/HTTP命令使用专用临时资源，不接入既有业务数据库；服务clean构建与HTTP串行。注册50不意味着全跑50通过，旧26/32成功及40失败分别保留历史证据。

## 依赖和报告

需要Node20以上和已安装的项目依赖；static/browser需pnpm8，static/database需Bash，database/http需可用Docker守护进程，browser及部分实际HTTP阶段需已安装的Playwright包；所有Mock browser及九个真实浏览器阶段需Chromium；六个纯原生API阶段及五服务boot不要求Playwright。精确分配见注册表的needs，缺少Chromium不会跳过纯API阶段。入口仅检查所选分组需要的依赖；static不会探测Docker。入口不安装依赖。编排文件本身使用Node；原有Bash阶段仍要求Bash，Windows环境也需提供Bash。POSIX中断会转发给阶段进程组；Windows只转发给直接子进程，Windows资源清理能力不能视为已验证。

若系统默认pnpm版本不同，可以指定PATH上的裸命令（如 `PNPM_EXEC=pnpm`）、实际可执行文件或相对/绝对`.cjs`文件，不能附加命令参数：

```bash
PNPM_EXEC=/absolute/path/to/pnpm.cjs node code/scripts/test/verify-reliability.cjs --group static
```

入口校验该程序版本为8，在报告目录内生成Node启动器并加入子进程PATH，使原有脚本内部调用 `pnpm` 也使用相同版本。路径通过Node参数传递，不拼接为shell命令；无需修改全局pnpm或项目依赖。

每阶段有单独日志，`manifest.json` 在每阶段结束后更新，包含命令参数、工作目录、开始时间、耗时、退出码、信号及错误。成功、失败、跳过有独立数组；依赖缺失的阶段标记 `skipped` 并写原因，整体退出非零，不能当作成功。

普通阶段失败后仍继续后续独立阶段，最终保留第一个真实失败的退出码；仅有跳过时退出1。子进程信号终止记为失败，SIGINT/SIGTERM对应130/143。收到中断时向活动阶段转发信号并等待其退出/清理，后续阶段明确跳过。这里没有通过tee处理管道退出状态，也没有擅自强制移除其他资源。若已有隔离脚本的清理停滞，入口同样等待，不能声称资源已清理。

`static` 的内部完整日志通过 `TEST_REPORT_DIR` 放在统一目录的 `workspace-details`；隔离脚本可能另行生成自己的临时工件目录，其路径保留在阶段日志里，统一入口不复制或删除这些工件。

## 历史自检证据（32阶段版本）

执行：

```bash
node code/scripts/test/verify-reliability.selfcheck.cjs
```

13项通过，0失败。自检通过导出的编排函数注入替身执行器，另以真实Node子进程验证退出23和SIGTERM清理；没有执行项目整套、真实服务或数据库测试。覆盖：

1. 参数非法、重复、缺值和分组校验。
2. 当前注册表32阶段（包含显式OSS夹具参数）及既有脚本路径存在。
3. 串行执行、失败后继续、成功/失败/跳过分离及首个退出7不被后续退出9覆盖。
4. 缺失依赖只能记跳过，整体非零。
5. 真实替身子进程输出落盘，退出23原样传播。
6. 不存在程序的启动错误记失败。
7. 中断状态记失败143，后续阶段不启动。
8. 真实替身子进程收到SIGTERM后先写清理标记，再退出143。
9. pnpm覆盖启动器保留含 `$()` 和反引号的字面路径，嵌套pnpm使用该版本；依赖提示保留。
10. PATH上的裸pnpm命令解析到真实文件后再创建启动器，实际启动成功。
11. 缺少Chromium时，6个纯API HTTP及1个启动替身阶段仍通过，2个浏览器阶段明确跳过且总退出1。
12. static分组仅探测pnpm/Bash，不调用Docker或浏览器检查。
13. 未知CLI参数实际进程退出2。

本次只执行上述自检、语法及差异空白检查。分组和all全量运行留给共享构建/运行任务释放后的主执行者；此文档不宣称统一全量或远程CI已经通过。

## 注册表版本记录

最初20阶段；取得分析HTTP和五服务隔离启动证据后扩展到22阶段（static2/browser6/database6/http8）。已有22阶段的实际验收清单为历史快照，保留其原始阶段数量，不改写为新版本结果。

当前增加 `auth-response-races` 静态阶段，总数23（static3/browser6/database6/http8）。新阶段执行当前源码、真实Axios/Pinia/Vue的16项迟到401检查，使用受控adapter，不启动网络或服务。入口自检保持13项并核对新阶段的精确脚本参数；此注册表变更不代表已经重新执行23阶段全量。浏览器实际用例数随独立spec增长，配置阶段数量仍为6，历史报告中的用例数也不回写。

随后取得消息重试HTTP独立证据，将 `overnight-message-retry-http.cjs` 加入HTTP串行组。当前总数24（static3/browser6/database6/http9）；23阶段是前一注册表版本，22阶段实际验收快照仍保留。本次只更新编排并运行13项自检，不将新注册数量描述为24阶段全量已通过。尚未验证的渠道capability检查不在注册表。

主执行者独立复验渠道39组HTTP后，将message-capability-http加入串行HTTP组；当前注册25阶段(static3/browser6/database6/http10)。自检13/13通过；这里是编排版本，不表示已执行新版25阶段全量。旧24、23、22阶段记录保留为历史。

SOP显式模拟配置已独立验证8项后注册browser第7阶段；当前26阶段(static3/browser7/database6/http10)，自检13/13通过。历史清单不回写，新版完整运行仍须取得实际清单。

三个新增UI脚本各取得单独真实证据后加入HTTP，三个独立Mock套件也已验证后注册。当前32阶段(static3/browser10/database6/http13)，自检13/13，完整all32正在根执行者复验；此前完整all26为历史真实快照，不能回写为32。

额外安全门禁 `node code/scripts/test/check-business-ui-harness-safety.cjs` 单独检查三脚本无profile拒绝及真实Docker create后start失败的清理，共3组（每组两类检查）；创建的数据库容器不会启动。该命令有独立证据，CI在业务链前运行，并单独上传工件，不计入32阶段的数字。

02:38根完整执行当前32阶段全部通过、0失败0跳过，manifest `/tmp/open-scrm-unified-all-32/manifest.json`。此前“正在复验”保留为当时记录，本段为当前完成证据。独立安全门禁最终3组通过（scrm-ui-harness-safety-snfSGw），不混入32阶段。后续源码变动须重新验证，不能沿用该快照。

## 04:17 当前编排与独立安全证据

当前注册50（static4/browser14/database10/http22），编排自检14项通过，日志 `/tmp/open-scrm-runner-selfcheck-50.log`。新增精确客户授权只读GET策略断言，禁止其它消息读写；缺Chromium场景明确13项API/启动替身通过、9个实际浏览器跳过、总结果非零。自检使用替身，不声称真实50业务全跑完成。

独立工具安全门禁已扩展7组（notification、message-logs、customer-consent、notification-history、consent-read、observed-dashboard、customer）。每组验证缺专属profile拒绝，并真实Docker create后注入start失败且只清理自己持有ID；不启动数据库/服务，不计入50阶段。新原生业务工具各自有profile/失败清理检查，不能将7组夸大为所有脚本。

## 续办补充检查（当前50阶段之外）

扫码持久幂等、Studio bigint和管理员角色关系的实际PG检查分别使用overnight-channel-scan-postgres.cjs、overnight-studio-identifiers-postgres.cjs、overnight-admin-user-postgres.cjs；扫码清理逻辑另有同名selfcheck。三脚本使用当前源码内存转译、各自专用PG，不构建dist、不运行HTTP或真实外部提供方。CI已增加独立步骤顺序执行这四命令，不改变50阶段注册数；远程CI未执行。本轮完整结果以resumed-delivery报告及新manifest为准，历史32成功/40失败/首次续办中止均保留。
