# 运营服务 PostgreSQL16 与实际 HTTP 验证

日期：2026-10-26（Asia/Shanghai）。使用一次性 PostgreSQL16 / Redis 容器，实际启动 auth、gateway、operation、message 四个服务。未连接项目已有数据库，没有外部消息发送。

## 运行方式与防护

仓库根执行：

```bash
node code/scripts/test/overnight-operation-http.cjs
```

脚本检查已存在的 `postgres:16-alpine` / `redis:7-alpine` 镜像，创建只绑定 loopback、随机宿主端口的一次性容器。等待 PostgreSQL **TCP** 就绪后执行仓库完整初始化 SQL，使用专用客户、登录账户及任务。四个服务在独立 loopback 端口启动，实际通过登录接口取得 JWT，再经网关调用运营接口。

运营服务的消息地址额外经过测试专用防护代理；只有明确的 `messageType: 5`、专用目标 ID 与允许的发送路径可到达实际消息服务。省略类型、默认类型或其他发送会被拒绝并导致验证失败。客户 ID / 群 ID 的比较兼容 PostgreSQL bigint 返回的安全十进制字符串，不修改转发正文。防护代理不会接通任何真实渠道。

测试结束或中途异常均清理自建服务进程、Playwright 子进程、防护代理及两只容器，并逐项验证退出或不存在；清理失败会令整个验证失败。日志、数据库查询和结果 JSON 保留在脚本打印的临时目录中。

## 发现与修复证据

首次真实启动失败：`operation-service` 的生产编译包含 `*.spec.ts`，Midway 加载 `dist/controller/mass-task.controller.spec.js` 时触发 Vitest CommonJS 导入异常，服务退出。此前 `mw build` 成功无法证明实际服务能启动。

已在运营服务 `tsconfig.json` 排除 `**/*.spec.ts`。确认 `dist` 无任何受版本管理文件且是忽略目录后，清理旧生成产物并重新构建。新脚本进一步断言生产目录不含可执行 `.spec.js`，实际初始化四个运营实体并启动 HTTP 服务；未采用删除测试源文件或禁用单元测试的方式绕过故障。

运营实体 `mass_task`、`sop_execution`、`sop_step`、`sop_template` 均通过真实 PostgreSQL16 TypeORM 初始化。当前实体列类型未触发不兼容异常。

## 最终结果

- PostgreSQL **16.13**，实际 TCP、初始化 SQL、TypeORM metadata 与生产服务启动均通过。
- 专用 Playwright HTTP 用例 **5项通过**，无跳过。
- 运营服务单元测试 **6个文件64项通过**，`tsc --noEmit` 通过；隔离脚本重新构建四个服务均通过。
- 防护代理转发 **5次 Mock 发送**，拒绝计数0；另注入1次 HTTP200 失败计数响应，未转发该注入请求到消息服务。
- 数据库严格断言及清理验证通过；`result.json` 中 `testsPassed`、`cleanup.passed`、`passed` 均为 `true`。

五项实际 HTTP 场景：

1. 未登录请求被网关拒绝；登录后创建群发任务，执行两条 Mock 消息，查询显示 `status=2`、`successCount=2`、`failCount=0`。
2. 客户 SOP 实际调用消息服务，执行进度保存为 `currentStep=1`、状态完成，记录成功日志。
3. 一分钟延时 SOP 通过实际接口暂停、恢复、取消；各状态在 PostgreSQL 中可读，取消时进度仍为0。
4. 群 SOP 的消息和素材两步均完成；SOP 的群类型2正确映射到消息群类型3，数据库产生两条 `target_type=3` 的 Mock 日志。
5. 防护代理对专用 Mock 内容返回 HTTP200，但正文明确报告 `success=0, failed=1`；SOP 必须转为失败、进度0并记录失败证据，不能误记成功。

最终数据库为一条完成的群发任务、四条分别完成/取消/完成/失败的 SOP 执行记录；消息日志总计5条，全部 `message_type=5`、`send_status=1`。受控失败场景没有真实发送或额外消息日志。

## 边界

这不是实际企微/短信/邮件发送或生产部署验证。群目标9004只是专用 Mock 目标标识，本批不证明群目录存在、成员有效或真实平台群可发送。SOP 仍使用旧消息入口，不代表具备 v1 营销同意闸门能力。

延时控制测试在一分钟计时到期前完成状态操作，然后关闭隔离环境；它证明实际 HTTP 控制与数据库状态，不单独证明跨越一分钟后的行为。延时到期后的暂停/取消语义另由执行器虚拟时钟单元测试覆盖。本批不证明进程重启恢复、多副本执行互斥、外部副作用 exactly-once 或完整经营业务效果。

成功证据目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-operation-http-qDXTiy`。其中 `result.json` 保存 metadata、端口、转发请求、注入响应及清理证据；`database-evidence.txt` 为实际数据库结果，`playwright-output.txt` 为执行报告。首次启动失败证据在同层 `open-scrm-operation-http-eJ0fnU`；临时文件后续可能被系统清理，可通过上述命令重跑。
