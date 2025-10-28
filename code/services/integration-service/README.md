# Integration Service - 集成服务

## 概述

集成服务负责与第三方平台的对接，包括企业微信、钉钉等。提供统一的集成接口和数据同步能力。

## 核心功能

### 1. 企业微信集成
- 企业微信配置管理
- Access Token 管理与自动刷新
- 通讯录同步（部门、员工）
- 客户联系人同步
- 消息推送
- 回调事件处理

### 2. 数据同步
- 增量同步和全量同步
- 同步任务调度
- 同步日志记录
- 同步状态监控

### 3. 接口代理
- 统一的第三方API调用
- 请求限流和重试
- 错误处理和日志记录

## 技术栈

- **框架**: Midway.js
- **ORM**: TypeORM
- **数据库**: MySQL
- **缓存**: Redis
- **消息队列**: RabbitMQ
- **HTTP客户端**: Axios

## 项目结构

```
integration-service/
├── src/
│   ├── config/              # 配置文件
│   │   └── config.default.ts
│   ├── controller/          # 控制器
│   │   ├── wework.controller.ts
│   │   └── health.controller.ts
│   ├── service/             # 服务层
│   │   ├── wework-api.service.ts
│   │   └── wework-sync.service.ts
│   ├── entity/              # 数据实体
│   │   ├── wework-config.entity.ts
│   │   └── sync-log.entity.ts
│   ├── dto/                 # 数据传输对象
│   │   ├── wework-config.dto.ts
│   │   └── sync.dto.ts
│   ├── interface/           # 接口定义
│   ├── middleware/          # 中间件
│   └── configuration.ts     # 服务配置
├── test/                    # 测试文件
├── package.json
├── tsconfig.json
└── README.md
```

## API 接口

### 企业微信配置管理

#### 获取配置
```http
GET /api/wework/config
```

#### 创建配置
```http
POST /api/wework/config
Content-Type: application/json

{
  "corpId": "企业ID",
  "corpSecret": "应用Secret",
  "agentId": 1000001,
  "token": "消息Token",
  "encodingAesKey": "消息加密密钥",
  "enabled": true
}
```

#### 更新配置
```http
PUT /api/wework/config/:id
Content-Type: application/json

{
  "corpSecret": "新的Secret",
  "enabled": true
}
```

#### 删除配置
```http
DELETE /api/wework/config/:id
```

#### 测试连接
```http
POST /api/wework/config/test
```

### 数据同步

#### 触发同步
```http
POST /api/wework/sync
Content-Type: application/json

{
  "syncType": "department|user|customer|full",
  "force": false
}
```

#### 查询同步日志
```http
GET /api/wework/sync/logs?syncType=department&status=success&page=1&pageSize=20
```

#### 获取同步状态
```http
GET /api/wework/sync/status
```

#### 同步部门
```http
POST /api/wework/sync/departments
```

#### 同步员工
```http
POST /api/wework/sync/users
```

#### 同步客户
```http
POST /api/wework/sync/customers
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

## 环境配置

### 必需环境变量

```env
# 服务端口
PORT=7004

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

# 企业微信配置
WEWORK_CORP_ID=企业ID
WEWORK_CORP_SECRET=应用Secret
WEWORK_AGENT_ID=应用AgentId

# 消息队列配置
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
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

### 测试
```bash
pnpm test
```

## 数据同步机制

### 同步类型

1. **部门同步** (`department`)
   - 同步企业微信部门结构
   - 建立部门层级关系
   - 更新部门信息

2. **员工同步** (`user`)
   - 同步员工基本信息
   - 同步员工部门关系
   - 更新员工状态

3. **客户同步** (`customer`)
   - 同步客户联系人
   - 同步客户标签
   - 更新客户关系

4. **全量同步** (`full`)
   - 按顺序执行所有同步
   - 确保数据完整性

### 同步策略

- **增量同步**: 默认模式，只同步变更的数据
- **全量同步**: 强制模式，同步所有数据
- **定时同步**: 通过调度任务定期执行
- **手动同步**: 通过API接口手动触发

### 同步状态

- `pending`: 等待执行
- `running`: 执行中
- `success`: 成功完成
- `failed`: 执行失败
- `partial`: 部分成功

## 错误处理

服务使用统一的错误处理机制：

- 所有API调用都会记录日志
- 失败的同步任务会自动重试（最多3次）
- 关键错误会发送告警通知
- 同步日志会详细记录错误信息

## 监控指标

- API调用成功率
- 同步任务执行时间
- 同步数据量统计
- 错误率和错误类型分布

## 注意事项

1. **Access Token管理**
   - Token会自动刷新
   - Token存储在Redis中
   - Token过期前30分钟会主动刷新

2. **API限流**
   - 企业微信API有频率限制
   - 服务会自动处理限流重试
   - 批量操作会自动分批执行

3. **数据一致性**
   - 同步过程使用事务保证
   - 失败的同步会完整回滚
   - 支持手动修复数据

4. **安全性**
   - 敏感配置加密存储
   - API调用需要鉴权
   - 日志中不记录敏感信息

## 依赖服务

- `auth-service`: 用户认证和授权
- `customer-service`: 客户数据管理
- MySQL: 配置和日志存储
- Redis: Token缓存和分布式锁
- RabbitMQ: 异步任务队列

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 企业微信基础集成
- 部门、员工、客户同步
- 同步日志和监控

