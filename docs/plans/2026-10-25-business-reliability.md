# Business Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复业务评估中可复现的企业隔离、统计语义和 SOP 控制问题，保留可验证边界。

**Architecture:** 沿用既有服务与数据库，不新增平台或财务范围。跟进接口采用网关租户上下文并验证客户归属；统计区分状态快照与发生事件；SOP 在动作前读取控制状态，并保证恢复不会重放已完成步骤。企微配置与回调先调查，不用默认企业推导生产多租户能力。

**Tech Stack:** Midway / TypeORM / PostgreSQL / Vitest / Vue 3。

## Task 1 — 跟进记录企业隔离

- 修改 `code/services/customer-service/src/controller/follow-up.controller.ts`，从可信上下文取企业和操作者，创建、查询均验证客户归属；列表增加企业过滤；非法 ID / 分页拒绝。
- 新增 controller 回归测试，先运行确认旧实现失败，再修复。
- 为 customer-service 加入与其余服务一致的 Vitest 配置及 `test:unit` 入口，排除测试文件进入生产构建。
- 验证伪造正文身份、跨企业客户读写、同企业正常读写和分页边界。
- 运行时复核发现跟进实体残留 MySQL 类型，PostgreSQL metadata 构建实际失败；初始化脚本也遗漏跟进表。补失败测试后更正类型，增加新库 DDL 与既有数据卷的幂等建表迁移，不自动操作用户数据库。

## Task 2 — 统计快照口径

- 复核 daily 聚合、summary、前端字段。数据库没有状态变化事件，不能伪造“当日流失”历史。
- 以测试说明状态=正常与流失属于快照；流失库存不能区间累加。
- 经复核：旧 `lost_customer_count` 实际是已删除库存（status=0），不应直接改成 status=2 并重新解释旧数据。采用 canonical `deletedCustomerCount` 等准确字段，旧数据库列及单日字段为弃用别名；summary 去掉错误累计字段。
- 保持历史数据库列兼容，明确 API/显示口径，更新相关测试和文档；避免将正常状态称为行为活跃。

## Task 3 — SOP 停止与恢复

- 测试暂停/取消发生在延时中或动作中；后续动作不得执行，保存进度不得覆盖控制状态。
- 恢复从已完成步骤之后开始，避免重复 worker；明确当前进程内执行与延时恢复的限制，不宣称可持久化恢复。
- 运行相关服务测试、类型检查及必要构建。

## Verification / Handoff

每项先观察失败再修复；更新 `docs/services/*/README.md` 及相关事实入口。完成后报告测试证据、文件与下一批；不部署、不发送真实消息、不推送远程。

## Task 4 — 企微协议兼容（独立第二批）

- 一手参考：企微团队成员发布的 [Python 回调示例](https://github.com/sbzhu/weworkapi_python/blob/master/callback_python3/WXBizMsgCrypt.py)，`PKCS7Encoder.block_size=32`，`DecryptMsg` 接收 URL 的签名、时间戳与 nonce。仓库自加解密 round-trip 无法单独证明互操作。
- 新增独立固定密文向量（填充长度大于16）及完整填充校验；旧实现应失败。
- POST 从 query 获取 `msg_signature/timestamp/nonce`、从 XML 获取 `Encrypt`，更新控制器测试与原 E2E 请求形状。拒绝缺失、数组和错误签名。
- 只交付协议修复；事件业务分发、可信租户绑定和真实平台账号验证另外实施。现有配置只有外部企微 corpId，SCRM 租户仍是部署配置；不能靠“最新启用配置”扩展成多企业接入。

## 验证记录

- 第一批经独立代码复审，修正了暂停/取消期间失败日志丢失、身份校验与二次解析不一致两项边界问题；都先观察回归测试失败再修复。
- 四个受影响服务（customer / analytics / operation / integration）与运营前端构建通过；全库单元测试、全库类型检查通过。全库 lint 仍被既有 gateway 格式问题与生成产物扫描阻断，未将其宣称为全门禁通过。
- 在全新临时 **PostgreSQL 18** 中执行完整 `init-db.pg.sql` 与两次幂等迁移，验证跟进列类型；通过实际 TypeORM repository + 跟进控制器验证身份来源、列表企业过滤、跨企业读写拒绝、无身份拒绝。临时数据库已停止；没有操作项目既有数据库。本项目目标 PostgreSQL 16 的实际部署/E2E仍需单独验证。
- 真实平台账号、事件业务分发和用户经营效果未验证；没有真实消息发送、部署或远程推送。
