# SOP动作配置严格校验与实际边界验证（2026-10-26）

对应[计划](../plans/2026-10-26-sop-action-validation.md)及[此前只读发现](2026-10-26-sop-action-boundary-review.md)。本批只改operation动作DTO、模板保存/执行器及相关回归/独立harness；customer.addTags与message严格DTO/引用由对应所有者实现，没有在此跨域编辑。根任务解除ALL40源码冻结后才实施；真实构建与HTTP按独占窗口串行。

## 修复与兼容

共用sop-action-validation用于保存和执行：canonical正安全员工/目标编号、INT32标签/模板引用、1–100提醒/标签数组并去重，拒绝boolean/单ID数组/指数/十六进制/空白/前导零/小数/溢出。坏配置在任何下游调用之前失败，不推进当前步骤。延迟整数非负、仅minute/hour/day、最多365天，负值在是否等待之前校验；30day及原长timer分段保持。

模板inline/batch嵌套不再仅验证object。直接模板服务在create前/替换delete前也验证。步骤名最多100Unicode码点、stepOrder正INT32。未知metadata不被丢弃，保存仍用白名单控制顶层字段、JSON字符串和已文档动作别名兼容。模板类型与触发/恢复目标一致；群保存拒客户专属动作，执行拒legacy混合目标行。正常group原先就拒客户操作，本批未宣称证明正常group同号误操作。

分配按真实客户code200响应核对id及followUserId；打标签确认code200，目标服务全批拒绝则SOP失败；通知按success/count明确确认。这里站内通知是数据库通知，不是messageType5模拟消息，也不涉及外部服务发送。

小裁定action.templateId：仅步骤1/3、optional JSON正整数INT32，字符串/布尔/null拒绝；条件forward，未提供时payload完全无该属性。它只作为元数据，不替换正文/extra/channel。下游本企存在检查由message负责；本企disabled/异channel引用允许，外企404失败。

## 红→绿证据

- 主配置新增82项先 **72失败/10通过**，修复后82全绿；随后扩展目标ID/业务确认/metadata/数据库字段边界。
- 客户HTTP200业务确认新增回归先5失败/34通过，修复为实际code200包络后通过；没有要求不存在的success:true字段故意破坏合法客户接口。
- Trigger原Joi宽松ID转换：新增目标测试先4失败/53通过，改为原始值canonical校验后通过。Control追加先2失败/72通过，execution safeMAX数字仍允许。
- 模板路径原假设纠正：原56项合法MAX_SAFE只来自mock，不能证明PostgreSQL int4。合法边界改INT32_MAX并增加INT32+1/MAX_SAFE拒绝，先 **8失败/56通过**，修复后64通过。
- optional模板引用/转发与INT32 DTO扩展先 **13失败/96通过**；补严格numericINT32与conditional forward后通过。未提供属性缺省保持另有正向断言。
- 恢复模板类型变化先1失败/46通过；加入恢复前匹配guard，现有控制测试fixture补真实模板必有的templateType1，不放宽生产校验迎合缺字段mock。
- 过长名称与恢复组合先3失败/113通过；名称改100Unicode码点，100个emoji正向保持；stepOrder此前已按INT32收紧，补边界回归。提醒/标签101原始项拒绝、30day等兼容均有测试。

动作校验阶段最终 `operation-service vitest run`：**10文件255项通过**（新增独立DTO74、执行/保存边界50；原路径56→64）。tsc --noEmit exit0，harness node --check及git diff --check通过。既有28项执行控制、9项模板事务/隔离等继续通过。没有声称已运行新的前端测试，本批未改前端。

## 真实INT32红证据

先执行独立harness的INT32选例，未修controller上限时实际gateway→operation→PostgreSQL16四个请求均 **HTTP500/code22003**：GET template与steps各使用2147483648、9007199254740991。artifact `open-scrm-sop-action-http-uy6HXH`，testsPassed=false/passed=false、cleanup.passed=true，进程/容器均清理。此前一次夹具把标签表误写成tag，在启动服务前SQL失败并清理；修正为实际customer_tag/customer_tag_relation后才取得上述有效红证据，不将夹具失败当产品红证据。

修复后模板路径及模板ID DTO按INT32400；execution实体与DDL都为BIGSERIAL，仍保留safeMAX。未笼统缩小customer/user/group或execution编号。

## 独立真实正向12场景

入口 `node code/scripts/test/overnight-sop-action-http.cjs`，专用 `sop-action-runtime.config.ts` / `tests/sop-action-runtime.spec.ts`。新PG16/Redis、真实auth/customer/message/operation/gateway，普通用户实际登录；没有API成功响应模拟或现有用户数据库。服务仅访问本次loopback依赖，未启动前端。无关服务URL转自有503 listener。容器create→立即登记→start，Bootstrap需专用marker/DB profile、loopback非默认PG/Redis端口及服务白名单。

模板/步骤均为直接写入临时库的legacy夹具，刻意绕过新保存校验来检查执行防线；不是自然业务历史。12项：

1. legacy boolean分配失败，客户原owner14102保持。
2. scientific提醒配置失败，无非法通知。
3. 有效+外企标签混批由实际customer API拒绝，SOP失败无进度/无部分标签。
4. 负延迟失败，不立即分配员工1。
5. canonical staffId字符串明确转数字14103，实际分配成功。
6. canonical提醒串/数字重复去重，只产生一条recipient14103通知。
7. 正常group与同号客户94101并存，客户专属动作拒绝。
8. 显式Mock5消息带optional自企模板ref成功。
9. 无效inline/batch配置拒绝，原步骤不被删除；合法重保存保留未知metadata与staffId别名；模板/触发类型不匹配400。
10. 四个INT32路径均400，模板ID execute/batch/query越界400；execution safeMAX control仍200/count0。
11. legacy JSON-string素材动作转发相同自企模板ref，保持显式正文/extra。
12. foreign模板ref实际message404，SOP失败且不新增日志。

最终artifact `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-sop-action-http-pZD5Ya`：**12 passed / 0 skipped，6.5s，exit0**。SQL精确核对：10条执行，94121/22/23/24/27/30为status3/currentStep0，94125/26/28/29为status1/currentStep1；客户94101最终owner14103；customer_tag_relation零行；notification恰一条user14103/title=sop-valid-notification。message_log恰两条，均corp1/target94101/messageType5/status1/templateId94201，正文分别SOP action Mock only与SOP material Mock only，extra.fixture和keep=true保持。

94201模板是本企status0、messageType1，仅用作metadata引用，SQL确认其状态/渠道没被改写；请求仍明确Mock5，不会因为引用异channel模板调用真实企微。外企94202没有日志。合法保存保留staffId与metadata.keep，素材action_content依然JSON-string，没有被执行器改写。完整证据见database-evidence.txt及Playwright输出。

result.httpCases=12、testsPassed/cleanup.passed/passed均true，errors为空。自有6个子进程退出、2个容器移除、503 listener关闭。端口PG64736/Redis64747/auth64764/customer64765/message64766/operation64767/gateway64768。构建与HTTP窗口已明确释放。

## 证据边界

本批是实际服务HTTP+PostgreSQL验证，不是实际浏览器UI；两条消息成功都是Mock，站内通知只写专用库，不代表第三方送达。30day使用虚拟时钟/分段回归，没有实际等待30天。复用旧process-local运行限制不在本批声称解决。完整并发、持久化调度与生产部署仍不由这12项证明。

脚本收尾核对：pZD5Ya调用的是mw build，未显式带--clean；其12项实际结果和SQL有效，但本页不据此单独宣称该轮显式清空dist。独立harness现已明确传build --clean，供根任务下一次独立复验；该命令标志收尾未另占共享窗口重跑，生产源码无变化。

## 追加：inline创建原子性与字段存储边界

根任务只读发现createTemplate先存parent再存steps，补充受控数据库失败验证，期间其他HTTP窗口占用，先仅跑不碰dist的独立PG。

新增 `node code/scripts/test/overnight-sop-create-postgres.cjs`：创建自有随机loopback PG16容器，加载当前TS源码到内存，使用真实TypeORM repository；不构建dist、不启动HTTP/Redis。合法模板/步骤第二条受专用CHECK拒绝，断言驱动23514。旧源码artifact `open-scrm-sop-create-pg-tsHQj6` 实际parentCount1/childCount0，整体exit1；cleanup通过。这个红证明不依赖无效DTO或过长字段，而是有效输入在数据库写入阶段失败。

修复后模板及全部步骤从同callback manager取得repository并创建。新unit组合先15失败/80通过，绿色后全服务 **11文件276项通过、tsc exit0**：新增atomic10项，配置DTO由74扩85。覆盖parent+steps管理器事务、步骤失败回滚、optional省略、allowlist，actionType溢出/小数/错误类型、合法SMALLINT两端/null，templateName varchar100与长TEXT description。

核对实际DDL/entity：template_name varchar100、step_name varchar100、action_type SMALLINT nullable、description TEXT。名称按Unicode码点校验；actionType仅接受JSON整数[-32768,32767]或null，不任意缩成1–5、不改原动作映射。description不新增任意业务短上限，PG验证10000字符仍保留。

绿色PGartifact `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-sop-create-pg-B1oHjF`，PG57171：**6个源方法/PG检查通过**，受控23514时parent0/child0；可省略steps/description，合法多步骤/metadata/allowlist完整；SMALLINT越界在驱动前拒绝；100emoji名称与10000字描述实际持久化。接着在同一专用数据库执行原 `overnight-sop-postgres.cjs` **5项通过**。原批量回滚测试不再用新前置校验会拦截的101字名称，而用合法名称触发临时CHECK 23514，继续验证数据库事务回滚；跨企、正常替换/防伪造、并发完整性保留。result.testsPassed/cleanup/passed全true，容器确认不存在。

## 追加：原子补丁后fresh实际13场景

根任务重新分配独占窗口后，harness显式对auth/customer/message/operation/gateway执行 `mw build --clean`，专用PG16/Redis与实际网关认证。原12项继续运行，新增第13项为真实HTTP inline创建合法own-tag模板，再触发SOP成功，验证实际CustomerController code200确认没有破坏合法打标签。

artifact `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-sop-action-http-64SRnJ`：**13 passed / 0 skipped，7.1s，exit0**。前面外企混批/群客户专属动作已断言关系0，最后正向才新增本企94111，最终customer_tag_relation恰1行且foreign94112不在其中。实际HTTP创建的新模板corp1/createUser14102/descriptionNULL和其步骤完整存在；执行完成。

SQL最终11条执行：此前6条失败currentStep0；原4条合法成功加本次own-tag成功，共5条status1/currentStep1。客户owner14103、notification恰1条recipient14103，message_log恰2条明确Mock5/owned94201ref，原正文与extra.keep/fixture均保持。disabled异channel引用原模板元数据未变，foreignref没有日志。INT32路径/DTO400与execution BIGSERIAL safeMAX控制200/count0继续通过。

本次PG60401/Redis60404/auth60421/customer60422/message60423/operation60424/gateway60425，自有503 listener60426没有请求。result.httpCases13、testsPassed/cleanup.passed/passed均true，errors为空；6子进程退出、2容器移除、listener关闭。构建/HTTP窗口已释放。该轮替代此前12作为最新源码真实证据；旧pZD5Ya记录保留其历史快照语义。
