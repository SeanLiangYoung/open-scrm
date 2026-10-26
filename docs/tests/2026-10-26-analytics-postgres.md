# 分析快照：隔离 PostgreSQL 验证

夜间批次于北京时间2026-10-25 23:55后执行，使用全新 PostgreSQL16.13 容器、独立数据库 `overnight_analytics`，真实 TypeORM 实体及 `DailyStatService`。没有启动 HTTP 服务、没有操作已有业务数据库。

## 结果与复现

在仓库根运行：

```bash
bash code/scripts/test/overnight-analytics-postgres.sh
```

主执行者运行退出0，**7项具名检查通过**：

1. PostgreSQL16版本与真实分析实体初始化成功。
2. 日表不存在时 `snapshotAvailable: false`、采集时间为空，兼容零值不再被当作实际零观测。
3. 实际日表存在时 `snapshotAvailable: true`，正常/已删除客户库存、采集时间和消息/SOP成功率准确。
4. 同日不同企业及不同日期查询隔离，不存在的企业/日期不会获得另一企业的日表。
5. 从真实数据库查询两日行：事件数相加（新增客户5、发送10），库存只取最后日（正常8、已删除5、总客户13），没有把旧流失列当事件累加。
6. 归因客户数只计本企业实际存在的去重客户；外企ID、缺失ID、群标识、失败发送和窗口外发送不增加客户分子，重复触达不重复计客户。
7. 对另一企业反向验证，不能将第一企业客户ID当成本企业已关联客户。

后两项先用真实PG复现旧查询错误：本企业仅1个客户时，外企/缺失引用使分子误计为3。修复`FunnelGapQueryService`的客户归属连接后为1，反向企业为0；消息总发送分母保持原口径，未把Mock日志误称真实渠道触达。

脚本使用回环15440端口，端口占用即失败；仅删除自己成功创建的容器ID，核对容器消失，清理失败返回非零。启动探测使用容器内TCP连接，避免将PostgreSQL初始化阶段的临时Unix socket服务误判为最终就绪。

## 代码与范围

- [隔离入口](../../code/scripts/test/overnight-analytics-postgres.sh)
- [数据库断言](../../code/scripts/test/overnight-analytics-postgres.cjs)
- [服务契约](../services/analytics-service/README.md)

`snapshotAvailable` 是 overview 的新增兼容字段。旧行没有采集时间仍应属于已存在快照，此边界另由单测验证；实际DDL的更新时间为NOT NULL，数据库测试不人为更改该约束。该服务完整单测为5文件/14项，类型检查和构建通过。以上结果不是HTTP验证，也不表示完整归因链路或用户经营效果已经验收。
