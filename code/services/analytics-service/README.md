# Analytics Service - 数据分析服务

## 概述

数据分析服务负责收集、聚合和分析各类业务数据，提供实时统计、趋势分析和数据报表功能。

## 核心功能

### 1. 每日统计
- 客户数据统计（新增、流失、活跃）
- 员工活跃度统计
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
- **数据库**: MySQL
- **缓存**: Redis
- **日期处理**: dayjs

## API 接口

### 概览统计

#### 获取概览数据
```http
GET /api/analytics/overview?date=2025-10-28
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

#### 获取趋势数据
```http
GET /api/analytics/trend?days=7
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
GET /api/analytics/daily?startDate=2025-10-01&endDate=2025-10-31
```

### 渠道统计

#### 查询渠道统计
```http
GET /api/analytics/channel?startDate=2025-10-01&endDate=2025-10-31&channel=douyin
```

#### 获取渠道排行榜
```http
GET /api/analytics/channel/ranking?startDate=2025-10-01&endDate=2025-10-31
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
GET /api/analytics/staff?startDate=2025-10-01&endDate=2025-10-31&staffId=123&page=1&pageSize=20
```

#### 获取员工排行榜
```http
GET /api/analytics/staff/ranking?startDate=2025-10-01&endDate=2025-10-31
```

## 环境配置

```env
PORT=7008
DB_HOST=localhost
DB_PORT=3306
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
- MySQL: 数据存储
- Redis: 实时数据缓存

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 每日统计功能
- 渠道分析功能
- 员工分析功能
- 趋势分析功能

