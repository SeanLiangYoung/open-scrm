# 客户营销同意闭环：隔离 HTTP 验证

本报告属于 2026-10-26 夜间验收批次；实际执行时间为 **2026-10-25 22:57–23:08 Asia/Shanghai**。使用真实 PostgreSQL 16、Redis 7、auth-service、message-service 与 gateway-service，以 Playwright 经实际 HTTP 网关验证，不替代成控制器直接调用。

## 结果

**本报告的同意闭环与双企业验收为2个E2E通过、0跳过，进程退出码为0。当前隔离harness已扩展为3个用例，新增消息幂等重放，最新执行同样3项通过；详见[幂等重放验证报告](./2026-10-26-message-idempotency-http.md)。** 最后一次在数据库自动断言和清理失败判定修正后执行，`result.json` 同时记录 `testsPassed: true`、`cleanup.passed: true`、`passed: true`。第二个用例增加真实双企业登录与伪造身份头对抗验证；最终证据以当前两个用例及自动清理核验的结果为准。

验证路径：

1. 通过真实 auth-service 登录签发 JWT。
2. 未携带 JWT 的授权请求，网关返回 401。
3. 授权请求中的 `corpId` / `userId` 注入和空文案版本返回 400；撤回请求中的 `corpId` 注入返回 400。
4. 不存在的客户授权返回 404。
5. 专用客户 `id=9001, corp_id=1` 先清理到无有效授权，再分别记录 `e2e-consent-v1` 和 `e2e-consent-v2` 两条营销授权。
6. 使用 `messageType: 5`、`consentPurpose: marketing`、`regionPackId: test-e2e-policy` 经网关发送成功，结果 `data.success=1`。
7. 撤回返回 `revokedCount=2`。
8. 随后的相同客户营销请求返回 403。
9. 再次撤回返回 `revokedCount=0`。
10. 数据库自动断言：该客户恰有两条已撤回记录，恰有一条成功 Mock 消息日志。最终查询保留两个文案版本，均为已撤回。

独立的第二个 HTTP 用例使用 `admin`（企业 1）与 `consent_other`（企业 2）分别通过真实 auth-service 登录，不手工签发 JWT。企业 2 用户属于正常启用状态、非管理员，角色列表为空；同意接口目前不要求管理员权限。测试专用客户为 `9003 → 企业1` 与 `9002 → 企业2`，不复用首个生命周期用例的客户。

双企业验证内容：

- 匿名请求即便带有伪造的 `x-corp-id` / `x-user-id` 仍返回 401。
- 两个真实 JWT 分别搭配相反企业的伪造头，对本企业客户授权成功，返回与数据库均保留 JWT 对应的企业。
- 两个方向的跨企业授权及撤回均返回 404，不能插入错误归属记录或撤回对方授权。
- 两个方向的跨企业营销发送均返回 403，不能借用另一企业已有的授权。
- 企业1的本企业 Mock 发送成功、撤回返回1；之后企业2的授权仍允许其本企业 Mock 发送，证明跨企业拒绝与本企业撤回未影响对方。
- 最后分别以真正所属企业 JWT 撤回各自剩余授权。数据库自动断言三个专用客户共有4条互不重复的正确归属营销证据且均已撤回，并恰有3条成功 Mock 日志，每个客户1条，企业均正确。

此测试使用关闭静默窗的测试区域包，消除运行时刻影响；不构成真实地区政策或法律合规证明。它验证撤回完成之后的新请求，不验证已在执行中的消息取消，也不验证旧消息入口或没有声明营销目的的发送。

## 可复现入口

从仓库根目录运行：

```bash
node code/scripts/test/overnight-consent-http.cjs
```

脚本：[overnight-consent-http.cjs](../../code/scripts/test/overnight-consent-http.cjs)。既有测试：[consent-lifecycle.spec.ts](../../code/e2e/tests/consent-lifecycle.spec.ts)。API 契约：[message-service README](../services/message-service/README.md)。

前提是本机 Docker 可用、已有 `postgres:16-alpine` / `redis:7-alpine` 镜像、工作区依赖已安装。脚本使用服务本地工具构建三个服务，不安装依赖、不下载镜像、不修改服务配置或初始化 SQL。运行前已核对 auth/gateway/message 的运行配置、网关代理身份头约定和 Harness 文档。

脚本创建带 PID/时间后缀的独立容器与全新数据库 `consent_http`，从当前 `init-db.pg.sql` 初始化，并插入专用客户9001、9002、9003及企业2的专用用户；后续扩展另为幂等重放提供9004/9005，不改变本报告三个客户的记录断言。企业2用户使用种子管理员相同的测试密码哈希、不同用户名；未改动认证实现、初始化SQL或已有用户数据库。Docker 随机分配仅绑定回环的数据库与 Redis 端口；三个 HTTP 服务同样使用探测到的空闲回环端口，通过 Bootstrap 临时配置覆盖固定端口。不会终止或复用既有服务。服务只使用脚本显式传入的临时数据库与 Redis 地址。

Playwright 的 `CONSENT_E2E_DISPOSABLE` 与 `CONSENT_E2E_CUSTOMER_ID` 环境门槛保持不变，脚本为自己的临时实例设置它们。双企业用例还要求 `CONSENT_E2E_ISOLATION_CUSTOMER_ID`、`CONSENT_E2E_OTHER_CUSTOMER_ID` 和第二账号用户名/密码环境变量，均由脚本为自己的临时实例设置。当前脚本要求输出确实包含 `3 passed` 且无 skipped，避免将跳过当作成功。唯一发送类型为 Mock 5，不触发真实外部消息渠道。

## 最后一次运行证据

最后一次独立端口为：PostgreSQL `54114`，Redis `54115`，auth `54120`，message `54121`，gateway `54122`。这些是当次随机端口，不是固定运行契约。

数据库最终状态：

```text
corp_id | subject_id | purpose   | policy_version   | revoked
1       | 9001       | marketing | e2e-consent-v1    | true
1       | 9001       | marketing | e2e-consent-v2    | true
2       | 9002       | marketing | e2e-isolation-v1 | true
1       | 9003       | marketing | e2e-isolation-v1 | true

corp_id | message_type | send_status | target_id
1       | 5            | 1           | 9001
2       | 5            | 1           | 9002
1       | 5            | 1           | 9003
```

临时运行证据目录为 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-consent-http-TN1pvN`，内含三个服务启动日志、`playwright-output.txt`、`database-evidence.txt` 和 `result.json`。该目录是本机临时证据，系统可以清理；本报告保留关键结果。首次完整通过目录为同一临时父目录中的 `open-scrm-consent-http-GvrAnM`。

运行结束后脚本通过 `finally` 停止自己启动的三个 Node 进程，等待并验证其退出，并删除自己创建的两个容器。删除后使用成功的 Docker 查询核验容器不存在；清理任一步骤报错都会记录到 `cleanup.errors`、使最终 `passed: false` 并以非零退出。最终 `result.json` 仅在清理核验完成后写入。完成后独立查询确认 `open-scrm.verification=consent-http` 标签下无运行容器，且没有本次 harness 服务进程残留。未写入现有用户数据库，未提交或推送代码。

## 清理错误回归验证

复核曾发现旧 harness 在 `docker rm` 返回非零时只打印错误，仍写入整体成功。使用临时 Docker 包装器复现：包装器先实际删除容器以避免泄漏，再故意返回退出码 1；旧 harness 错误地退出 0。

修正后以相同注入重跑，HTTP 测试仍通过，但进程正确退出 1，最终记录 `testsPassed: true`、`cleanup.passed: false`、`passed: false` 和两项清理命令错误。失败路径证据位于同一临时父目录的 `open-scrm-consent-http-k8HU83/result.json`。随后移除包装器影响，进行上述最终正常验收，成功核验三个进程均退出、两个容器均不存在。该故障注入没有遗留容器。

## PostgreSQL 就绪与 Node 20 验证

独立复跑发现 `pg_isready` 默认 Unix socket 可能短暂连接到 Docker 初始化阶段的临时 PostgreSQL，随后初始化服务关闭时立刻执行 SQL 会失败。harness 已改为容器内 `pg_isready -h 127.0.0.1 -p 5432`，只等待最终提供 TCP 的服务，不把临时 Unix-only 初始化服务当作就绪。

修正后使用本机 **Node v20.20.0** 完整运行（含三个服务构建、启动、Playwright 与清理核验），退出码 0，`testsPassed`、`cleanup.passed` 与 `passed` 均为 true。`PATH` 显式将 Node20 置前，子服务通过 `process.execPath` 启动，避免只用 Node20 做语法检查却仍以 Node24 运行服务。上述最后一次端口和证据目录对应这次 Node20 验证；它证明本机 Node20 运行，不等于 GitHub Linux runner 已实际执行。

## 工程边界

本报告覆盖真实数据库与 HTTP 闭环、认证、输入拒绝和两个真实企业账号的授权/撤回隔离及网关身份头对抗。未测试并发授权与撤回，也不据此声称并发线性化保证。当前授权写入需要共享 PostgreSQL 中的 `customer` 表，此处验证的也是该部署约定。

更新日期：2026-10-25。
