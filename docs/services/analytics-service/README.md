# Analytics Service - 数据分析服务

`GET /api/v1/analytics/overview` 增加 `snapshotAvailable`：当天日表行存在时为 `true`，不存在时为 `false`。缺失时保留兼容的零值字段，但它们不代表实际观测到零。`snapshotObservedAt` 是实际采集更新时间；旧行没有该时间也仍属于已存在快照，不能仅用时间是否为空判断快照是否存在。运营看板根据显式 `snapshotAvailable: false` 提示尚无聚合数据。

归因代理的`customersWithAttribution`只计算与本企业实际`customer`行匹配的去重目标；成功日志中的外企/缺失客户引用不会再抬高分子。真实PostgreSQL夹具已覆盖该错误和反向企业隔离；窗口内成功消息总数和hint数仍保留各自口径。

## 概述

数据分析服务负责收集、聚合和分析各类业务数据，提供实时统计、趋势分析和数据报表功能。

## 核心功能

### 1. 每日统计
- 客户新增记录数，以及正常状态/已删除客户库存快照
- 启用员工库存快照（不是行为活跃度）
- 消息发送统计
- SOP执行统计
- 群发任务统计

### 2. 渠道分析
- 渠道扫码统计
- 渠道转化率分析
- 渠道留存分析
- 渠道排行榜

### 3. 员工分析
- 员工客户统计
- 员工互动统计
- 员工任务完成率
- 员工排行榜

### 4. 数据可视化
- 趋势图数据
- 概览数据
- 对比分析

## 技术栈

- **框架**: Midway.js
- **ORM**: TypeORM
- **数据库**: PostgreSQL
- **缓存**: Redis
- **日期处理**: dayjs

## API 接口

### 日表指标口径（2026-10-25）

当前数据库没有完整的客户状态变更事件流水，不能从当前状态反推某日真实流失或行为活跃人数。为兼容现有数据库，保留旧列名，API 提供准确命名：

- `normalCustomerCount`：聚合时 `customer.status=1` 的库存，旧 `activeCustomerCount` 为弃用别名。
- `deletedCustomerCount`：聚合时 `customer.status=0` 的库存，旧 `lostCustomerCount` 为弃用别名；不是业务流失人数，`status=2` 才表示客户模型中的流失。
- `enabledStaffCount`：聚合时启用员工库存，旧 `activeStaffCount` 为弃用别名。
- `snapshotObservedAt`：日表最后写入时间；无日表时为 `null`。回填过去的 `statDate` 仍读取聚合当时的当前状态，不能解释成该历史日收盘状态。种子/外部导入记录也不应当作真实业务采样。
- `metricSemantics.customerCounts=current_state_at_aggregation` 随日表、overview、trend、summary 返回，明确上述边界。

**summary 契约修正**：删除错误的 `additive.lostCustomerCount`；已删除库存只存在于 `snapshotAtEnd.deletedCustomerCount`。原来的跨日累加会让同一客户反复计数，不保留错误累计值作为兼容字段。

`trend.normalCustomers` / `deletedCustomers` 为库存曲线；旧 `activeCustomers` / `lostCustomers` 数组为弃用别名，不能用作活跃/流失事件曲线。新增客户仍按客户记录 `create_time` 计算，不能直接解释成广告新增或首次购买。

消息/SOP 成功率仅表示内部状态计数，可能包含模拟通道结果，不代表客户送达、阅读、成交或因果增量。尚未引入业务事件采集、真实成交归因或历史状态重建。

### 概览统计

#### 获取概览数据
```http
GET /api/v1/analytics/overview?date=2025-10-28
```

响应示例：
```json
{
  "success": true,
  "data": {
    "newCustomerCount": 120,
    "lostCustomerCount": 5,
    "activeCustomerCount": 850,
    "totalCustomerCount": 5000,
    "activeStaffCount": 45,
    "totalStaffCount": 50,
    "messageSendCount": 300,
    "messageSuccessRate": 98.5,
    "sopExecuteCount": 150,
    "sopSuccessRate": 95.0
  }
}
```

#### 区间汇总（Sprint 4）
```http
GET /api/v1/analytics/summary?startDate=2025-10-01&endDate=2025-10-31
```
返回 `additive`（区间内可加指标之和）、`snapshotAtEnd`（最后一日快照）、`rates`（消息/SOP 成功率，基于 additive）。

#### 手动触发日聚合（当前登录企业）
```http
POST /api/v1/analytics/jobs/aggregate-daily
Content-Type: application/json

{"statDate":"2025-10-28"}
```
省略 `statDate` 时默认聚合**当天**。定时任务每日 **03:00** 聚合**上一自然日**（见 `DailyStatAggregationJob`）。

#### 获取趋势数据
```http
GET /api/v1/analytics/trend?days=7
```

响应示例：
```json
{
  "success": true,
  "data": {
    "dates": ["10-22", "10-23", "10-24", "10-25", "10-26", "10-27", "10-28"],
    "newCustomers": [100, 120, 95, 110, 130, 105, 120],
    "lostCustomers": [3, 5, 2, 4, 6, 3, 5],
    "activeCustomers": [800, 815, 808, 814, 838, 840, 850],
    "messageSends": [250, 280, 260, 290, 310, 275, 300]
  }
}
```

### 每日统计

#### 查询每日统计
```http
GET /api/v1/analytics/daily?startDate=2025-10-01&endDate=2025-10-31
```

### 渠道统计

#### 查询渠道统计
```http
GET /api/v1/analytics/channel?startDate=2025-10-01&endDate=2025-10-31&channel=douyin
```

#### 获取渠道排行榜
```http
GET /api/v1/analytics/channel/ranking?startDate=2025-10-01&endDate=2025-10-31
```

响应示例：
```json
{
  "success": true,
  "data": [
    {
      "channel": "douyin",
      "scanCount": 5000,
      "addCustomerCount": 1200,
      "conversionRate": 24.0
    },
    {
      "channel": "xiaohongshu",
      "scanCount": 3000,
      "addCustomerCount": 900,
      "conversionRate": 30.0
    }
  ]
}
```

### 员工统计

#### 查询员工统计
```http
GET /api/v1/analytics/staff?startDate=2025-10-01&endDate=2025-10-31&staffId=123&page=1&pageSize=20
```

#### 获取员工排行榜
```http
GET /api/v1/analytics/staff/ranking?startDate=2025-10-01&endDate=2025-10-31
```

## 环境配置

```env
PORT=7008
DB_HOST=localhost
DB_PORT=5432
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=open_scrm

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 统计配置
AGGREGATE_INTERVAL=60
REALTIME_CACHE_TTL=300
HISTORY_RETENTION_DAYS=365

# 依赖服务
CUSTOMER_SERVICE_URL=http://localhost:7002
MESSAGE_SERVICE_URL=http://localhost:7006
OPERATION_SERVICE_URL=http://localhost:7004
ACQUISITION_SERVICE_URL=http://localhost:7003
```

## 开发指南

### 安装依赖
```bash
pnpm install
```

### 启动开发服务器
```bash
pnpm dev
```

### 构建
```bash
pnpm build
```

## 数据聚合

数据分析服务从各个业务服务收集数据，按照以下维度进行聚合：

- **时间维度**: 日、周、月、年
- **渠道维度**: 不同获客渠道
- **员工维度**: 各个员工的业绩
- **客户维度**: 客户行为分析

## 依赖服务

- `customer-service`: 客户数据
- `message-service`: 消息数据
- `operation-service`: 运营数据
- `acquisition-service`: 获客数据
- PostgreSQL: 数据存储
- Redis: 实时数据缓存

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 每日统计功能
- 渠道分析功能
- 员工分析功能
- 趋势分析功能


## 已存日表观测序列（2026-10-26）

新增只读 `GET /api/v1/analytics/observed-daily?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`，独立协议，不改旧trend/daily响应。日期必填且须为实际日历日，闭区间1–31天；倒序、缺字段、未知query和非法日期400。完整企业与操作者身份须为十进制正安全整数，缺失/畸形401；任一身份header存在时不能从state借字段补回。对外认证仍必须经过网关，服务不把任意直连头当JWT证明。

返回 `startDate/endDate/dateBasis:'stored_daily_stat_date'/eventDayTimezone:null/points`。points为完整YYYY-MM-DD升序日历；无日表行observed=false、采集时间及所有指标null，存在的0保持0。旧行采集时间null仍observed=true。events含newCustomerRecords/messageLogRecords/sopExecutionRecords；inventory含totalCustomers/normalCustomers/deletedCustomers。仅白名单字段，无内部行ID、企业ID或原始客户/消息内容。

UTC仅用于严格日历计算以避免DST漂移，不代表过去事件分桶UTC。原聚合按数据库日期边界，历史时区未记录，eventDayTimezone保持null。库存是实际采集时当前状态，不是statDate当日收盘状态；不累加、不前向填充、不重建流失。消息是create_time落日的日志行数量（含Mock/历史结果），不是发送尝试或真实送达次数；SOP为create_time落日的执行记录，不称当日完成事件。

运营Dashboard消费新接口，分别展示记录创建趋势与库存采集快照，并提供可读日表；缺测断线、实测0保留，旧无采集时间明确提示。页面加载只GET，移除了挂载时隐式POST aggregate-daily；日聚合仍由既有任务/明确运维操作负责，读取不会为缺测日回填。最近最多100客户样本饼图保留其样本标签。

新增后端31项测试（util15/service2/controller14），analytics全8文件52项通过；新Mock浏览器9项通过，既有运营契约25项通过。首轮实际HTTP6+UI2通过且daily/source表读取前后全行JSON相同；随后补严格controller身份校验与截图稳定性，最新实际复验由根任务串行执行，详见[趋势验证报告](../../tests/2026-10-26-observed-dashboard.md)。本地合成日表夹具不代表自然历史采样或生产验证。
