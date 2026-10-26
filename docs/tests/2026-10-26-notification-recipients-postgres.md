# 站内通知接收人的企业边界与整批保存验证

执行时间：2026-10-26 00:30–00:33 Asia/Shanghai。对应[本企业员工目录与运营人员选择计划](../plans/2026-10-26-tenant-staff-operations.md)。验证使用临时PostgreSQL16和本机Node v20.20.0，不连接现有用户数据库，不触发外部消息。

## 结果

消息服务 **11个测试文件、98项通过**，其中新增通知接收人边界20项；`tsc --noEmit`与`mw build`均退出0。独立真实PG harness **6项检查通过**，进程退出0。运行完成后查询 `open-scrm.verification=overnight-notification` 标签，无剩余容器。

修复前先执行新单测，20项中19项失败：重复接收人产生重复通知，外企/停用/缺失员工及非法ID没有被拒绝，模拟批次保存失败可留部分结果。随后实现整批校验和事务，再执行至全部通过。

## 当前契约

`NotificationService.createNotification(corpId, dto)`仍接受单个数字员工ID或数字数组，成功结果仍为 `{success:true,count:数量}`。重复有效ID去重，数量为实际通知条数。接收人必须为非空正安全整数集合，企业身份同样必须为正安全整数；服务直接调用不接受数字字符串、小数、零、负数、空值或不安全数字。

通过共享数据库权威 `user` 表一次性查询全部员工，使用参数化企业条件、`status=1`和参数化bigint数组。任意员工缺失、不属于当前企业或停用，统一抛出400；拒绝发生在创建任何通知实体与保存之前，不透露具体哪位员工属于别家企业。

查询和保存通过同一个TypeORM事务管理器执行。查询带 `ORDER BY id FOR SHARE`，保持接收人归属/启用状态直至通知批次提交，避免校验后立即被停用的窗口。保存失败则整批回滚。标题、正文、通知类型、跳转链接、extra及到期时间参数的既有语义保持不变。

HTTP入口仍是 `POST /api/notification/`。控制器保持 `{success:true,data:{success:true,count},message}`封装；原DTO验证仍生效。本报告实际PG验证直接调用服务，不冒充HTTP或认证验证；真实双企业网关验证由独立staff HTTP工作流承担。

## 真实PostgreSQL检查

1. 实际PostgreSQL16与 `NotificationEntity` 元数据初始化成功。
2. 本企业两名启用员工提交 `[4101,4102,4101]`，仅保存两条；optional链接、extra和到期时间保留。
3. 分别混合有效员工与外企4201、停用4103、缺失4199，整批400且通知总行数保持原值。
4. 空数组、非法数字、数字字符串、空值、超出安全整数及混合类型数组均拒绝，行数不增加。
5. 通过临时数据库触发器在第二位接收人插入时注入失败，确认第一位接收人的通知也没有保存；触发器仅存在于临时数据库。
6. 对真实服务事务的校验查询设置测试闸门，另一条真实数据库连接尝试停用员工4105。`pg_blocking_pids`确认停用被共享行锁阻塞；释放闸门后，通知批次提交、停用完成。随后再次创建该员工通知返回400，行数不增加。这是一个受控的并发时序验证，不声称覆盖所有竞争时序。

## 复现

从仓库根目录执行：

```bash
bash code/scripts/test/overnight-notification-postgres.sh
```

脚本要求Docker可用且已有 `postgres:16-alpine` 镜像。它创建独立带PID后缀的容器、数据库 `overnight_notification`，由Docker分配空闲的回环端口，使用现有初始化SQL和仅在此库中的测试员工。就绪探测使用容器内TCP `127.0.0.1:5432`，避免把初始化期间临时Unix socket服务误判为就绪。

退出处理保留测试失败状态，检查容器删除结果并再次查询确实不存在；清理失败使整次运行非零退出。不复用、不删除任何预先存在容器，未修改初始化SQL、共享配置、依赖清单或其它业务测试脚本。

相关文件：

- [通知服务](../../code/services/message-service/src/service/notification.service.ts)
- [通知边界单测](../../code/services/message-service/src/service/notification.service.spec.ts)
- [临时PG入口](../../code/scripts/test/overnight-notification-postgres.sh)
- [实际PG服务检查](../../code/scripts/test/overnight-notification-postgres.cjs)

更新日期：2026-10-26。
