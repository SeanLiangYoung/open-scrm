# 客户跟进：隔离真实 HTTP 与企业边界验证

本报告属于2026-10-26夜间验收批次；实际执行于2026-10-25约23:07–23:09 Asia/Shanghai。与[直接控制器/数据库验证](./2026-10-26-customer-postgres.md)分开，这次启动真实 auth-service、customer-service 和 gateway-service，使用独立 PostgreSQL16.13 与 Redis7，通过 Playwright HTTP 请求验证。

## 结果与范围

正常运行退出0：**1项 Playwright E2E通过、0跳过**；包含**8个具名步骤、24次业务 HTTP 请求**。两个企业账号都通过真实登录得到JWT，没有手工签发或注入身份Token。

1. 初始化种子管理员实际登录，企业为1；克隆同一测试密码哈希的专用账号 `overnight_tenant_b` 实际登录，企业为902。
2. 匿名创建/列表，即使伪造 `x-corp-id` / `x-user-id`，都返回401。
3. 企业A创建正文携带企业B的 `corpId` / `userId`，实际响应和数据库仍为企业A及真实管理员。
4. 企业A请求头伪造企业B身份，网关覆盖为JWT身份，记录仍归企业A；合法跟进类型和UTC闰日时间持久化正确。
5. 企业B正常创建自己的客户记录。
6. 企业A列表排除刻意构造的“相同客户ID、其他企业ID”历史污染夹具；分页 total=2，第二页大小1。企业B正常列表 total=1。
7. 双向跨企业读取/写入均返回404，包括请求同时伪造目标企业身份头的情况。
8. null/数组正文、空白/对象内容、非法跟进类型、无效日历日期、指数ID、非法页码、超大页大小和不安全偏移均返回400。

随后脚本在数据库断言精确行数和身份：总计**4条跟进**，企业A两条、企业B自己的客户一条、预先插入的隔离污染夹具一条。被拒请求没有额外记录。所有真实写入仅发生于脚本创建的临时数据库。

## 运行入口

仓库根目录：

```bash
node code/scripts/test/overnight-customer-http.cjs
```

- [隔离运行器](../../code/scripts/test/overnight-customer-http.cjs)
- [独立 Playwright 配置](../../code/e2e/playwright.customer-followup-http.config.ts)
- [HTTP 测试源码](../../code/e2e/tests/customer-followup-http.spec.ts)
- [跟进 API 契约](../services/customer-service/README.md)

需要已安装依赖、可用 Docker 与本地 `postgres:16-alpine` / `redis:7-alpine` 镜像。运行器不安装依赖或下载镜像，不修改共享 Playwright 配置和业务源码；构建三个服务并通过 Bootstrap 临时配置绑定独立回环端口。PostgreSQL通过TCP就绪检查后执行完整初始化SQL，创建专用客户/账号/污染夹具。Node服务以UTC运行，使本次时间验证可重复；并非修改产品运行时区契约。

容器名称带PID/时间戳，标签为 `open-scrm.verification=customer-http`，不挂载项目文件或现有数据卷。随机数据库、Redis和HTTP端口只绑定127.0.0.1，显式覆盖数据库/Redis/服务地址，不复用已有服务。

## 正常证据

最终正常运行证据目录：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-customer-http-McQPqv`。目录包含三个服务日志、Playwright输出、数据库证据和最终 `result.json`；临时目录可被系统清理，本页保留关键事实。

当次端口：PostgreSQL54174、Redis54175、auth54178、customer54179、gateway54180（均为当次随机分配，不是固定契约）。最终 `result.json` 为 `testsPassed: true`、`cleanup.passed: true`、`passed: true`。PostgreSQL实际版本为16.13。

```text
corp_id | customer_id | user_id | follow_type | next_follow_time
902     | 9101        | 9102    | 1           | null  (污染夹具)
1       | 9101        | 1       | 1           | null
1       | 9101        | 1       | 4           | 2028-02-29 08:00:00
902     | 9102        | 9102    | 1           | null
```

## 清理与故障验证

清理等待自己启动的三个Node进程退出，必要时终止，再验证其退出；仅删除自己成功创建的容器ID，并通过成功的Docker查询确认不存在。清理错误会写入 `cleanup.errors`，使整体失败并非零退出。结果文件在清理完成后生成，不把测试通过等同于资源清理通过。

额外使用临时Docker包装器模拟“实际删除后，删除命令返回1”，避免故障验证本身泄漏容器。该运行的业务HTTP测试仍通过，但入口正确退出1，结果为 `testsPassed: true`、`cleanup.passed: false`、`passed: false`，包含两条清理命令错误；证据目录为同一临时父目录的 `open-scrm-customer-http-q7mQrv`。包装器随后删除，专用标签下无残留容器。

## 限制

本报告证明指定新库、账号和接口的实际HTTP/数据库行为，不代表其他客户/标签接口已完成租户审计。业务服务直连认证仍依赖可信网关网络边界；本次通过网关测试，不能把原始身份头视为独立凭证。没有真实消息发送、项目既有数据库操作、部署、提交或远程推送。完整CI远程运行仍待验收。
