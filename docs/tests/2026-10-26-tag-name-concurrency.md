# 标签同企业同名并发事务串行化

本轮是[标签完整性修复](2026-10-26-tag-integrity.md)完成后的独立补强，不回写该轮147单测/PG8/实际HTTP5或之前ALL40快照。只修改TagService、对应单元夹具/新增锁顺序回归及独立PG工具，没有修改标签UI、CustomerService逻辑、schema/迁移、用户数据库，没有clean构建或HTTP。

## 先取得真实PG红证据

修复前执行 `node code/scripts/test/overnight-tag-name-concurrency.cjs --red`，专用PG16.13、两个独立TypeORM DataSource/事务和实际TagService。包装实际repository.findOne，在两条数据库名称查询均已返回空后用同步Promise屏障同时放行；不是仅用sleep增加撞车概率。

工件 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-tag-name-concurrency-pg-KHJHQA/result.json` 保留3个场景的真实后端PID、empty-name观测和SQL：

- create/create：两个调用均成功，最终同corp2同名2行。
- create/batch：两个调用均成功，同名2行，batch另一项也写入1行。
- rename/create：两个调用均成功，原标签改名和新建形成同名2行。

保护检查 **3失败、0通过，退出1**，临时容器清理通过。该红记录来自advisory修复前源码；当前工具的red屏障有5秒有界释放，避免对已串行化源码误用历史模式时无限等待。现代码验收应使用默认绿色模式。

## 最小修复

[TagService](../../code/services/customer-service/src/service/tag.service.ts) create/update/batch/delete四个写事务进入后第一步均执行：

```sql
SELECT pg_advisory_xact_lock(hashtextextended($1, 0))
```

参数为 `open-scrm:customer-tag:${corpId}`，企业号来自完整验证身份，不来自body。使用当前事务manager执行，名称查询、父链锁、保存和删除均在锁之后。事务级锁于提交/回滚释放；不依赖企业已有标签行，首个标签也有可锁命名空间。已有父链行锁和batch完整事务保持。

没有新增全库唯一索引：保证的是经过这些TagService写入口的同企业名称串行校验，直接SQL或不遵守该命名空间的其他写入者不是数据库唯一约束保证。不同企业使用不同命名空间；本轮不修改数据库schema。

## 真实等待与结果（不是延时猜测）

执行 `node code/scripts/test/overnight-tag-name-concurrency.cjs`。第一连接实际save完成但仍停在事务callback内，尚未提交；启动第二连接并读取其真实pg_backend_pid。第三观察连接查询pg_stat_activity，必须看到第二PID的：

- wait_event_type = Lock
- wait_event = advisory
- query = SELECT pg_advisory_xact_lock(hashtextextended($1, 0))

只有取得该数据库等待证据后才放行第一事务提交。轮询20ms仅用于读取状态，未把经过某段时间当成锁成功；没有观察到advisory即检查失败。

最终工件 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-tag-name-concurrency-pg-WL6RC8/result.json`：**4通过、0失败，退出0**。每场景均包含等待证据。

1. create/create：开始corp2标签数0，第二连接等待；第一成功，第二400“标签名已存在”，目标仅1行。
2. create/batch：开始corp2标签数0，第二连接等待；第一成功，第二400同名，目标1行、batch额外项0行，未部分保存。
3. rename/create：开始1行，第一改名成功，第二等待后400同名，最终目标仅原主键200001一行。
4. 反向父级并发：A/B初始均根节点；第一将A设为B子节点，第二尝试将B设为A子节点，先被advisory阻塞，第一提交后第二400“父标签不能形成自引用或循环”。最终A.parent_id=B、B.parent_id=0，无环。

result.json的testsPassed、cleanup.passed、passed均true，errors为空；所有连接关闭，专用容器确认消失。工具不Bootstrap服务、不写dist、不过HTTP，不与SOP实际运行窗口争用共享构建。信号处理释放自身测试屏障并清理拥有资源；本轮实际执行证据为正常完成清理，不声称单独测试过强制中断分支。

## 回归证据

新增四个事务入口锁顺序单测；完整customer服务 **6文件151项通过**、tsc --noEmit通过。已有实际TS/Midway边界Node30项通过。旧不可变/父级/客户关系/实际save失败回滚PG **8/8通过**，新回归工件 `/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-tag-integrity-pg-BlweEq`，未覆写旧PG8/红证据目录。

本轮没有重新运行真实HTTP或前端构建，前一轮的UI/API5仍是其原时间点证据；主任务后续统一门禁应使用当前TagService。根任务同期只修改独立的CustomerService.create/客户DTO/其他CRUD路径，本轮没有编辑那些文件。
