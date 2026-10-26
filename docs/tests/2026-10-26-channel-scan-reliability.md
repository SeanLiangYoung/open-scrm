# M25 扫码可靠性验收（2026-10-26）

[计划](../plans/2026-10-26-channel-scan-reliability.md)对应[原始只读审查](2026-10-26-acquisition-integration-write-review.md)的三项确认问题。本报告记录修复后的新证据，不回写原始缺陷探针为通过。

## 最终行为

当前最终验收为下文追加审查后的47项单元/13组PG通过；首轮46项/12组证据保留为历史快照，未覆盖续期与清理的交错。

[活码API控制器](../../code/services/acquisition-service/src/controller/acquisition-api.controller.ts)的详情、最近归因、扫码写入统一使用[严格INTEGER编号校验](../../code/services/acquisition-service/src/util/channel-id.util.ts)，拒绝尾随字符、小数、指数、前导零、非正与越界，先400再返回，不进入repository。

[ChannelCodeService](../../code/services/acquisition-service/src/service/channel-code.service.ts)通过 TypeORM transaction，在 `{corpId,id}` 活码行上获取 `pessimistic_write`。获得锁之后取 PostgreSQL `clock_timestamp()`，判断24小时有效凭据；计数、[持久幂等凭据实体](../../code/services/acquisition-service/src/entity/channel-scan-event.entity.ts)、可选归因全部在同一事务提交。保存任一失败均回滚，重复事件读取最新计数。没有事件ID时按每次成功请求计数。事件凭据不充作归因历史。

业务事务成功提交后才通过主repository.manager独立autocommit执行清理，最多1000条过期凭据、`SKIP LOCKED`，不持有活码锁；清理失败只记录维护告警，不把已提交请求变成失败。此顺序避免全局清理拿到另一活码凭据锁时与业务行锁形成交叉。未新增后台调度器，闲时/维护告警后的定时或人工有界清理由部署方执行，语句见迁移注释；过期判定本身不依赖删除成功。

## 单元红绿与类型

以下命令从仓库根运行，`PATH`仅选择已安装pnpm8，不安装依赖：

```sh
PATH=/tmp/open-scrm-tools:$PATH pnpm --filter @scrm/acquisition-service test -- src/service/channel-scan-reliability.spec.ts
PATH=/tmp/open-scrm-tools:$PATH pnpm --filter @scrm/acquisition-service test
PATH=/tmp/open-scrm-tools:$PATH pnpm --filter @scrm/acquisition-service type-check
```

- 新[扫码回归](../../code/services/acquisition-service/src/service/channel-scan-reliability.spec.ts)最初31项，实际原实现27失败/4通过，退出1；修复后31通过。红日志 `/tmp/acquisition-scan-red.log`，初次绿 `/tmp/acquisition-scan-green.log`。
- 增加维护提交顺序、维护失败不否定已提交请求2项后，新文件33项通过；全服务6文件46项通过，退出0。最终日志 `/tmp/acquisition-all-test-final.log`。
- `tsc --noEmit`退出0，日志 `/tmp/acquisition-type-final.log`。没有clean build或HTTP。

## 实际 PostgreSQL16 验证

```sh
node code/scripts/test/overnight-channel-scan-postgres.selfcheck.cjs
node --check code/scripts/test/overnight-channel-scan-postgres.cjs
node code/scripts/test/overnight-channel-scan-postgres.cjs
```

[独立PG脚本](../../code/scripts/test/overnight-channel-scan-postgres.cjs)从当前源码内存转译加载实际TypeORM、控制器、服务，专用 `postgres:16-alpine` 容器、专用用户名/数据库、Docker随机分配的loopback端口。先create记录ID再start；只初始化自己的数据库，应用专属迁移两次。未Bootstrap、未HTTP、未访问Redis或真实提供商，HttpService stub立即拒绝任何网络调用。

最终12组全部通过，退出0，证据：

`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-channel-scan-pg-lpS6eg/result.json`

1. canonical初始化与专属迁移重复执行，三实体实际repository读取通过。
2. 同活码30个不同事件并发：`scan_count=30`、凭据30条。
3. 同事件20并发：1次新计数、19次replay，`scan_count=1`、归因1条。
4. 实际 `channel_code` CHECK拒绝：无凭据残留，解除故障同事件重试得到1/非replay。
5. 实际凭据表CHECK拒绝：计数回滚到0，解除故障重试得到1/非replay。
6. 实际归因表CHECK拒绝：计数0、凭据0；解除故障同事件重试成功且归因保存。
7. corp2请求corp3活码拒绝；两企业使用相同事件名，各自计数1、各自凭据。
8. 凭据到期后同事件再次计数到2；再次请求replay且保持2。
9. 1000条较早过期凭据被有界清理；同事件旧凭据ID `9007199254740993` 续期仍保留该精确字符串，最终仅该1条。没有Number舍入。
10. 实际持有活码锁，第二请求开始并经 `pg_stat_activity` 确认等待；观察数据库时间确认凭据在等待期间到期，释放锁后请求得到2/非replay。
11. 实际控制器3路径×4非法编号均400，活码未改；合法扫码仍成功。
12. 两个独立DataSource：第一计数保存但未提交时，第二连接真实等待 `Lock/transactionid`；释放后最终计数2。记录等待SQL，不靠单纯sleep猜测并发。

最终JSON包含每组检查、业务行/凭据/归因快照以及实际等待证据。cleanup关闭所有连接/显式runner后删除自身容器，再执行 `docker ps -a --no-trunc --filter id=... --format '{{.ID}}'`；必须退出0且输出为空才证明absence，daemon错误不会伪装清理成功。最终 `cleanup.passed=true`、`ownedContainerAbsent=true`、errors为空。

[清理自检](../../code/scripts/test/overnight-channel-scan-postgres.selfcheck.cjs)6/6通过：未创建容器无需Docker、正常absence、残留容器、daemon失败、命令无法启动、精确ID筛选参数。未实际发送SIGINT/SIGTERM；信号分支会记录实际cleanup结果，不能将该代码路径称为已实测通过。

## 初始化、保留与交付边界

专属[迁移](../../code/scripts/migrations/2026-10-26-channel-scan-event.pg.sql)已由主执行者同步到canonical [init-db.pg.sql](../../code/scripts/init-db.pg.sql)。新实体由现有 `**/entity/*.entity{.ts,.js}`发现；`synchronize:false`，既有数据库部署必须先应用迁移。现有服务schema审计会增加该实体/表，须在完整最终审计中复验，不能沿用旧表数。

新凭据与Redis旧键没有双写或自动搬迁。升级窗口已被旧实现接受的事件，若切换后重放可能再计一次；应停写切换或在业务端隔离该窗口。本次不声称跨旧/新存储的无缝幂等，也没有改真实渠道回调。无事件ID请求丢响应后的重试仍可能多计，这是明确的非幂等输入。

本次仅本服务单元、类型、独立真实数据库和清理自检通过。没有真实HTTP、完整运行时/远程CI、提供商送达验收；没有业务数据库写入、提交或推送。源码已冻结交给主任务最终验收，旧审查证据仍保留为历史红证。


## 交叉审查补修：过期凭据续期与清理竞态

首轮12组PG没有覆盖 TypeORM `save` 自身先SELECT后UPDATE的窗口。交叉审查在真实PG证明：续期读取到旧expiredreceipt，在save预查询后暂停；另连接的全局清理可删掉该receipt。续期事务随后更新0行却提交计数1，receipt空；同事件重试被当新事件计到2。首轮通过不足以证明此交错安全，原结果与主任务中断记录均保留。

本任务先重跑 `/tmp/open-scrm-scan-review-race.cjs`，实际退出1，artifact：

`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-scan-review-race-bdkkF2/result.json`

随后给现有PG脚本增加同样的实际TypeORM屏障case：在 `events.save` 的ID预查询完成后暂停，另一连接执行与线上一致的全局 `DELETE ... FOR UPDATE SKIP LOCKED`，记录实际删除数、首次提交后的receipt、同事件重试结果。修复前13组为12通过/1失败，退出1；artifact：

`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-channel-scan-pg-tdcYoe/result.json`

红证据：删除receipt id1共1条；首次提交 `{scanCount:1,replayed:false}` 后receipt为空；重试 `{scanCount:2,replayed:false}`。两次红复现的专用容器均严格清理通过。

修复仅给主业务事务中的 `events.findOne` 增加 `pessimistic_write`。活码锁之后锁定已存在凭据，保留至计数/receipt续期/归因共同提交；因此清理的 `SKIP LOCKED` 必须跳过该凭据。凭据若已先被清理，锁查询返回无记录，按新事件插入，仍受活码行锁串行。全局维护事务不获取活码锁，保留业务/维护协议相容。

新增unit先红：34项中33通过/1失败（未携带receipt锁），日志 `/tmp/acquisition-scan-renew-unit-red.log`。修复后执行相同服务test/type-check命令，全服务6文件47项通过、新文件34项通过，tsc退出0；日志 `/tmp/acquisition-scan-renew-all-green.log`、`/tmp/acquisition-scan-renew-type.log`。

实际PG扩展后的13组全部通过，退出0，最终artifact：

`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-channel-scan-pg-wr866T/result.json`

新增屏障证据为 `deleted=[[],0]`、首次提交后receipt仍1条、同事件重试 `{scanCount:1,replayed:true}`。前12组也全部重跑通过；`cleanup.passed=true`、`ownedContainerAbsent=true`、errors为空。清理selfcheck仍6/6、node语法检查通过。

没有build或HTTP；源码再次冻结交由主任务最终整体验收。跨旧Redis/新PG迁移、闲时维护、无事件ID重试等前述部署限制仍存在，未因本修复而消除。
