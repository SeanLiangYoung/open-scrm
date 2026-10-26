# PostgreSQL bigint 企业身份与消息幂等重放验证

实际执行时间：2026-10-26 00:17–00:22 Asia/Shanghai。使用本机 Node v20.20.0、临时 PostgreSQL16/Redis7，以及实际 auth、message、gateway HTTP 服务。唯一发送类型为 `messageType: 5`，没有真实外部消息。

## 已复现的问题

`message_log.corp_id` 是 PostgreSQL `bigint`。真实 TypeORM/pg 返回企业 ID 字符串，例如 `"1"`；请求上下文提供数字 `1`。旧 `resolveIdempotentReplay` 使用严格类型比较，错误地拒绝本企业原日志。随后尝试插入相同企业/幂等键，触发唯一键约束；并发冲突后的第二次重放判断同样失败。

先补单测后执行，观察到12项失败，包括数字可信身份与字符串库存身份不匹配，以及不明确/不安全身份被接受。随后在真实隔离 HTTP 中复现：第一次 Mock 发送成功，第二次同键请求返回500，响应含 PostgreSQL错误码 `23505`。另外两个同意闭环用例通过，失败运行也成功核验清理。失败证据目录为临时父目录中的 `open-scrm-consent-http-ox6nxd`。

## 最小修复

比较器接受安全正整数数字或规范正十进制字符串。安全数字转为十进制字符串，数据库 bigint 字符串直接精确比较，不经过 `Number`。空白、前导零、正负号、小数、指数写法、零、负数、Infinity、NaN及不安全数字不参与重放。相邻的 `9007199254740992` / `9007199254740993` 字符串仍可区分；`9223372036854775807` 字符串可精确匹配。

只改变同企业身份比较，未改动现有幂等键及内容语义：同企业/同键重试重放首次日志与首次内容，不因后来请求正文改变而发送第二次；相同键在不同企业分别存储。该比较器修复不等于整个 HTTP 租户上下文已支持超出 JavaScript 安全整数范围的企业 ID；本次实际网关验证使用企业1与2。

## 最终结果

- 消息服务单测：10个文件、**78项通过**。
- 消息服务 `tsc --noEmit` 通过。
- 消息服务生产构建通过（隔离 harness 启动前构建，随后实际启动服务）。
- 经真实网关的 Playwright：**3项通过、0跳过**。
- 最终进程退出码0；`result.json` 中 `testsPassed`、`cleanup.passed`、`passed` 均为true。

前三个用例分别验证原同意闭环、双企业授权隔离与新幂等重放。新增第三个用例通过真实登录取得两家企业 JWT，使用专用客户9004（企业1）与9005（企业2）：

1. 企业1首次请求建立日志。
2. 相同企业/键、改变正文的重试返回相同日志 ID、`idempotentReplay: true`、`success: 1`、`failed: 0`，正文仍为首次内容。
3. 企业2使用相同幂等键建立另一条日志，ID与企业1不同；自己的重试只重放自己的日志及首次内容。
4. 请求头 `Idempotency-Key` 与请求体 `idempotencyKey` 冲突时返回400，不建立额外日志。
5. SQL自动断言：这两个客户总共只有两条日志，每个客户/所属企业各一条、均为成功 Mock，且两个企业共用同一个幂等键。

既有同意测试仍保留4条正确归属且已撤回的证据记录，以及3条成功 Mock日志；新增幂等测试再产生2条日志，总共5条，重复请求及冲突请求都没有增加记录。

## 可复现入口与证据

```bash
node code/scripts/test/overnight-consent-http.cjs
```

当前 harness 要求完整执行 **3项通过且无跳过**，保留TCP就绪检查、独立容器和端口、进程退出及容器不存在的清理核验。清理失败会使整次运行失败，不提前写成功。

最终临时目录为 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-consent-http-x0lZJy`，包含 `result.json`、`playwright-output.txt`、数据库证据与三个服务日志。PostgreSQL端口61097、Redis61138、auth61185、message61186、gateway61187，仅为当次分配值。三个服务进程与两个容器均已核验清理。

代码与证据入口：

- [幂等身份比较器](../../code/services/message-service/src/util/message-idempotency.util.ts)
- [单测](../../code/services/message-service/src/util/message-idempotency.util.spec.ts)
- [实际网关E2E](../../code/e2e/tests/consent-lifecycle.spec.ts)
- [隔离执行脚本](../../code/scripts/test/overnight-consent-http.cjs)
- [原同意闭环与双企业验证报告](./2026-10-26-consent-http.md)

## 独立评审范围

同步只读核对了 analytics 的 `snapshotAvailable`、实际PG harness与SOP群目标映射、消息成功封装检查。未发现这些新增变更的可行动缺陷：缺失日表与现有旧记录明确区分；SOP组目标2正确映射为消息组目标3；正常发送与成功幂等重放的真实封装均满足单接收方 `success:1/failed:0`，未确认或失败结果不会被当成步骤成功。本报告未另行运行analytics或SOP测试，不把消息验证冒充其端到端证据。
