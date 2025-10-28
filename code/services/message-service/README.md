# Message Service - 消息服务

## 概述

消息服务负责系统内所有消息的推送和通知管理，包括企业微信消息、站内通知、短信、邮件等多种渠道的消息发送。

## 核心功能

### 1. 消息模板管理
- 模板CRUD操作
- 支持多种消息类型（文本、图片、链接、小程序、文件）
- 支持变量替换（模板引擎）
- 模板启用/禁用

### 2. 消息发送
- 单条消息发送
- 批量消息发送
- 根据模板发送
- 支持企业微信、站内通知、短信、邮件等渠道

### 3. 站内通知
- 创建通知
- 通知列表查询
- 标记已读/未读
- 未读数量统计
- 自动过期清理

### 4. 消息日志
- 发送记录查询
- 发送状态跟踪
- 失败重试机制
- 发送统计分析

## 技术栈

- **框架**: Midway.js
- **ORM**: TypeORM
- **数据库**: MySQL
- **缓存**: Redis
- **队列**: Bull (RabbitMQ)
- **HTTP客户端**: Axios

## 项目结构

```
message-service/
├── src/
│   ├── config/                  # 配置文件
│   │   └── config.default.ts
│   ├── controller/              # 控制器
│   │   ├── message.controller.ts
│   │   ├── notification.controller.ts
│   │   └── health.controller.ts
│   ├── service/                 # 服务层
│   │   ├── message-template.service.ts
│   │   ├── message-send.service.ts
│   │   ├── notification.service.ts
│   │   └── message-log.service.ts
│   ├── entity/                  # 数据实体
│   │   ├── message-template.entity.ts
│   │   ├── message-log.entity.ts
│   │   └── notification.entity.ts
│   ├── dto/                     # 数据传输对象
│   │   ├── message-template.dto.ts
│   │   ├── send-message.dto.ts
│   │   ├── notification.dto.ts
│   │   └── message-log.dto.ts
│   └── configuration.ts         # 服务配置
├── test/                        # 测试文件
├── package.json
├── tsconfig.json
└── README.md
```

## API 接口

### 消息模板管理

#### 创建模板
```http
POST /api/message/template
Content-Type: application/json

{
  "templateName": "欢迎消息",
  "templateType": 1,
  "messageType": 1,
  "content": "欢迎{{name}}加入我们！"
}
```

#### 更新模板
```http
PUT /api/message/template/:id
Content-Type: application/json

{
  "content": "更新后的内容"
}
```

#### 删除模板
```http
DELETE /api/message/template/:id
```

#### 查询模板列表
```http
GET /api/message/templates?page=1&pageSize=20
```

### 消息发送

#### 发送消息
```http
POST /api/message/send
Content-Type: application/json

{
  "messageType": 1,
  "targetType": 1,
  "targetIds": [1, 2, 3],
  "content": "消息内容"
}
```

#### 批量发送
```http
POST /api/message/send/batch
Content-Type: application/json

{
  "messageType": 1,
  "targetType": 1,
  "targetIds": [1, 2, 3, ...],
  "content": "消息内容"
}
```

#### 根据模板发送
```http
POST /api/message/send/template
Content-Type: application/json

{
  "templateId": 1,
  "targetType": 1,
  "targetIds": [1, 2, 3],
  "variables": {
    "name": "张三",
    "time": "2025-10-28"
  }
}
```

#### 重试发送
```http
POST /api/message/retry
Content-Type: application/json

{
  "logIds": [1, 2, 3]
}
```

### 消息日志

#### 查询日志
```http
GET /api/message/logs?page=1&pageSize=20&sendStatus=1
```

#### 获取日志详情
```http
GET /api/message/log/:id
```

#### 获取发送统计
```http
GET /api/message/statistics?startTime=2025-10-01&endTime=2025-10-31
```

### 站内通知

#### 创建通知
```http
POST /api/notification
Content-Type: application/json

{
  "userIds": [1, 2, 3],
  "notificationType": 1,
  "title": "系统通知",
  "content": "这是一条系统通知",
  "linkUrl": "https://example.com"
}
```

#### 查询通知列表
```http
GET /api/notification/list?page=1&pageSize=20&isRead=0
```

#### 标记已读
```http
PUT /api/notification/read
Content-Type: application/json

{
  "notificationIds": [1, 2, 3]
}
```

#### 全部标记已读
```http
PUT /api/notification/read/all
```

#### 获取未读数量
```http
GET /api/notification/unread/count
```

#### 删除通知
```http
DELETE /api/notification/:id
```

### 健康检查

#### 健康状态
```http
GET /health
```

#### 就绪状态
```http
GET /health/ready
```

## 数据字典

### 模板类型 (templateType)
- `1`: 文本消息
- `2`: 图片消息
- `3`: 链接消息
- `4`: 小程序消息
- `5`: 文件消息

### 消息类型 (messageType)
- `1`: 企业微信消息
- `2`: 站内通知
- `3`: 短信
- `4`: 邮件

### 目标类型 (targetType)
- `1`: 客户
- `2`: 员工
- `3`: 群

### 通知类型 (notificationType)
- `1`: 系统通知
- `2`: 业务通知
- `3`: 警告通知

### 发送状态 (sendStatus)
- `0`: 待发送
- `1`: 发送成功
- `2`: 发送失败

## 环境配置

### 必需环境变量

```env
# 服务端口
PORT=7008

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=open_scrm

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
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

### 启动生产服务器
```bash
pnpm start
```

### 类型检查
```bash
pnpm type-check
```

## 配置说明

### 批量发送配置
```typescript
message: {
  batchSize: 100,        // 每批次发送数量
  batchInterval: 1000,   // 批次间隔(ms)
  maxRetries: 3,         // 最大重试次数
  retryDelay: 5000,      // 重试延迟(ms)
}
```

### 企业微信消息配置
```typescript
wework: {
  enabled: true,
  maxTextLength: 2048,   // 文本消息最大长度
}
```

### 站内通知配置
```typescript
notification: {
  enabled: true,
  defaultExpireDays: 30, // 默认过期天数
}
```

## 消息发送流程

```
1. 创建消息日志记录
   ↓
2. 根据消息类型选择发送渠道
   ↓
3. 企业微信: 调用 integration-service
   短信: 调用短信服务商
   邮件: 调用邮件服务
   ↓
4. 记录发送结果
   ↓
5. 失败消息自动重试（最多3次）
```

## 模板变量示例

```typescript
// 模板内容
"尊敬的{{name}}，您的订单{{orderNo}}已发货，预计{{deliveryTime}}送达。"

// 变量数据
{
  name: "张三",
  orderNo: "20251028001",
  deliveryTime: "2025-10-30"
}

// 渲染结果
"尊敬的张三，您的订单20251028001已发货，预计2025-10-30送达。"
```

## 错误处理

所有API错误都会返回统一格式：

```json
{
  "success": false,
  "message": "错误信息",
  "code": 错误码
}
```

常见错误码：
- `400`: 参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误

## 监控指标

- 消息发送成功率
- 平均发送耗时
- 失败消息数量
- 未读通知数量
- 队列积压情况

## 依赖服务

- `integration-service`: 企业微信消息发送
- `customer-service`: 获取客户信息
- `auth-service`: 用户认证
- MySQL: 消息数据存储
- Redis: 缓存和分布式锁
- Bull: 消息队列

## 注意事项

1. **批量发送**
   - 建议每批不超过100条
   - 注意控制发送频率
   - 监控队列积压

2. **消息模板**
   - 变量名使用双花括号：`{{变量名}}`
   - 变量名不能包含特殊字符
   - 建议提前测试模板渲染

3. **站内通知**
   - 默认30天后自动过期
   - 定期清理过期通知
   - 监控未读通知数量

4. **性能优化**
   - 批量操作使用队列异步处理
   - 消息日志定期归档
   - 合理设置索引

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 消息模板管理
- 消息发送功能
- 站内通知系统
- 消息日志记录

