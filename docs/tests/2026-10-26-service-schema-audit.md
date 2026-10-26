# 已实现运营服务的 PostgreSQL 元数据与表结构就绪审计

执行日期：2026-10-26，最终检查完成于01:18 Asia/Shanghai。范围为获客、集成、分析、素材与内容生成五个已有实现的服务，排除财务业务扩展及README级前端脚手架。

## 结论

**未发现此次范围内可复现的数据库启动/读取阻塞。** 在全新PostgreSQL16.13、Node v20.20.0环境中，5组真实当前实体均完成DataSource初始化，16张对应表全部存在，195个映射列的实际SELECT及16个真实ORM读取全部通过。最终进程退出0，数据库容器已核验清理。

按阻塞优先级检查结果：

- 不支持的PostgreSQL实体列类型：0。
- 初始化SQL缺少已有实现所声明的表：0。
- 缺少映射列、数据库字段长度短于实体声明、数据库必填无默认列未被实体映射：均为0。
- 实际列SELECT或ORM读取失败：0。

因此没有根据本次证据应当立即修改的服务源码或自动补建的业务表。该结论只针对当前完整初始化SQL产生的新库；未检查用户现有库的迁移状态。

## 验证方法与覆盖

脚本仅读取当前源码，将实体文件在内存中以实际TypeScript装饰器/类型元数据编译，并使用现有TypeORM与PostgreSQL驱动。没有读取旧dist替代源码、没有模拟实体、没有启动Midway应用。所有审计DataSource强制`synchronize:false`，不会让自动同步掩盖缺表或字段问题。

每张表依次执行：参数化`to_regclass`核查、information_schema字段核查、覆盖全部映射列的`SELECT ... LIMIT 0`，以及真实repository的`find({take:1})`。不会输出用户行内容或配置密钥；记录中只包含结构信息与读取行数。

具体实体：

- acquisition-service，4个：channel_code、channel_scan_touch、content、platform_account。
- integration-service，2个：sync_log、wework_config。
- analytics-service，3个：channel_stat、daily_stat、staff_stat。
- asset-service，3个：asset_category、asset_usage、asset。
- content-generation-service，4个：content_source、content_variant、generation_job、variant_publish_link。

这些服务均有实际服务/控制器实现，并非因目录存在就假定已完成的脚手架。上述类型和表检查不等于各项业务语义或所有HTTP路由通过验收。

## 非阻塞差异

发现5处实体声明为`json`、初始化表使用`jsonb`：

- channel_code.staff_ids。
- channel_code.auto_tag_ids。
- content.media_urls。
- content.topics。
- asset.tags。

它们与“不支持的PostgreSQL类型”不同：元数据成功建立，实际SELECT可执行。还通过数据库返回的真实JSONB对象逐项调用当前驱动的实体字段水合逻辑，均保留原对象/数组内容，证据字段为`jsonbHydrationReady:true`。本次据此记为兼容存储差异，不当作启动阻塞，也没有擅自修改字段类型。未执行这些业务字段的完整创建/编辑往返或schema同步迁移。

## 可复现入口与证据

```bash
bash code/scripts/test/overnight-service-schema-audit.sh
```

要求Docker可用、已有`postgres:16-alpine`镜像与仓库依赖。脚本创建独立临时库`overnight_schema_audit`，仅绑定随机回环端口，运行现有完整`init-db.pg.sql`；不添加新领域表、不复用已有数据库。就绪检查使用容器内TCP，退出处理检查容器删除结果并确认不存在，清理失败会导致非零退出。

最新机器证据为：`/var/folders/qr/cp9jfqqs75j5_2r78cqsp9980000gn/T/open-scrm-service-schema-audit.HXDNxk/result.json`。其中`auditCompleted:true`、`entityCount:16`、`readReadyTables:16`、`blockers:[]`，5个兼容差异都有水合验证。该临时目录可能被系统清理，本报告保留关键结果。

- [审计入口](../../code/scripts/test/overnight-service-schema-audit.sh)
- [当前源码元数据/结构/读取检查](../../code/scripts/test/overnight-service-schema-audit.cjs)
- [完整初始化SQL](../../code/scripts/init-db.pg.sql)

## 未覆盖边界

没有启动服务HTTP、OSS、队列、外部平台OAuth、真实发布、LLM或Wiki调用；没有验证运行所需外部凭据，也不将这些未执行项目描述为已通过。本次没有修改任何服务源码、初始化SQL、共享配置、清单或用户数据库，没有执行共享服务构建。

## 续办源码快照的增量复验

最新50轮中schema阶段已通过：5服务17实体/17张表、200个映射列，blockers为空。比历史16实体/195列新增ChannelScanEventEntity及其5列；完整新库init含表/索引。当前Node24.21.0、PG16.13，本结果不回写上文Node20历史。证据 /tmp/open-scrm-resumed-final-all-50/24-database-service-schema-audit.log；最后完整验收仍以resumed-delivery为准。该检查不自动将迁移应用于既有数据库。
