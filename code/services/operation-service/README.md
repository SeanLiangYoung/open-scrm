# Operation Service - 运营服务

## 概述

运营服务是SCRM系统的核心业务服务，负责SOP（标准作业流程）自动化执行、消息群发、批量操作等运营任务的管理和执行。

## 核心功能

### 1. SOP自动化
- SOP模板配置管理
- SOP步骤配置（发消息、打标签、推素材等）
- SOP执行引擎
- 延时任务调度
- 执行进度跟踪

### 2. 群发任务
- 批量消息群发
- 批量打标签
- 批量客户分配
- 定时任务执行
- 执行结果统计

### 3. 自动化触发
- 添加好友触发
- 打标签触发
- 进群触发
- 手动触发

## 技术栈

- **框架**: Midway.js
- **ORM**: TypeORM
- **数据库**: MySQL
- **缓存**: Redis
- **队列**: Bull (RabbitMQ)
- **HTTP客户端**: Axios

## 项目结构

```
operation-service/
├── src/
│   ├── config/                  # 配置文件
│   │   └── config.default.ts
│   ├── controller/              # 控制器
│   │   ├── sop.controller.ts
│   │   ├── mass-task.controller.ts
│   │   └── health.controller.ts
│   ├── service/                 # 服务层
│   │   ├── sop-template.service.ts
│   │   ├── sop-execution.service.ts
│   │   └── mass-task.service.ts
│   ├── entity/                  # 数据实体
│   │   ├── sop-template.entity.ts
│   │   ├── sop-step.entity.ts
│   │   ├── sop-execution.entity.ts
│   │   └── mass-task.entity.ts
│   ├── dto/                     # 数据传输对象
│   │   ├── sop-template.dto.ts
│   │   ├── sop-step.dto.ts
│   │   ├── sop-execution.dto.ts
│   │   └── mass-task.dto.ts
│   └── configuration.ts         # 服务配置
├── test/                        # 测试文件
├── package.json
├── tsconfig.json
└── README.md
```

## API 接口

### SOP模板管理

#### 创建SOP模板
```http
POST /api/sop/template
Content-Type: application/json

{
  "templateName": "新客户欢迎SOP",
  "templateType": 1,
  "triggerType": 1,
  "description": "新客户添加后的自动化欢迎流程",
  "steps": [
    {
      "stepName": "发送欢迎消息",
      "stepType": 1,
      "delayTime": 0,
      "delayUnit": "minute",
      "actionContent": { "content": "欢迎加入！" }
    },
    {
      "stepName": "1小时后推送产品介绍",
      "stepType": 3,
      "delayTime": 1,
      "delayUnit": "hour",
      "actionContent": { "materialId": 123 }
    }
  ]
}
```

#### 更新SOP模板
```http
PUT /api/sop/template/:id
```

#### 删除SOP模板
```http
DELETE /api/sop/template/:id
```

#### 查询SOP模板列表
```http
GET /api/sop/templates?page=1&pageSize=20
```

### SOP执行

#### 触发SOP执行
```http
POST /api/sop/execute
Content-Type: application/json

{
  "templateId": 1,
  "targetType": 1,
  "targetIds": [1, 2, 3]
}
```

#### 查询执行记录
```http
GET /api/sop/executions?templateId=1&status=0
```

#### 控制执行
```http
POST /api/sop/execution/control
Content-Type: application/json

{
  "executionIds": [1, 2, 3],
  "action": "pause"  // pause/resume/cancel
}
```

### 群发任务

#### 创建群发任务
```http
POST /api/mass-task
Content-Type: application/json

{
  "taskName": "双十一促销群发",
  "taskType": 1,
  "targetType": 1,
  "targetIds": [1, 2, 3, ...],
  "messageContent": "双十一活动开始啦！",
  "messageType": 1,
  "scheduledTime": "2025-11-11T00:00:00"
}
```

#### 执行任务
```http
POST /api/mass-task/execute
Content-Type: application/json

{
  "taskId": 1,
  "immediate": true
}
```

#### 取消任务
```http
POST /api/mass-task/:id/cancel
```

#### 查询任务列表
```http
GET /api/mass-task/list?status=0
```

## 数据字典

### SOP模板类型 (templateType)
- `1`: 客户SOP
- `2`: 群SOP

### 触发类型 (triggerType)
- `1`: 添加好友
- `2`: 打标签
- `3`: 进群
- `4`: 手动触发

### SOP步骤类型 (stepType)
- `1`: 发消息
- `2`: 打标签
- `3`: 推送素材
- `4`: 分配客户
- `5`: 提醒员工

### 执行状态
- `0`: 执行中
- `1`: 已完成
- `2`: 已暂停
- `3`: 已失败

### 群发任务类型 (taskType)
- `1`: 群发消息
- `2`: 批量打标签
- `3`: 批量分配

### 任务状态
- `0`: 待执行
- `1`: 执行中
- `2`: 已完成
- `3`: 已失败
- `4`: 已取消

## 环境配置

```env
# 服务端口
PORT=7005

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

# 依赖服务地址
CUSTOMER_SERVICE_URL=http://localhost:7002
MESSAGE_SERVICE_URL=http://localhost:7008
INTEGRATION_SERVICE_URL=http://localhost:7007
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

## SOP执行流程

```
1. 触发SOP（添加好友/打标签/进群/手动）
   ↓
2. 创建SOP执行记录
   ↓
3. 按步骤执行：
   - 检查延迟时间
   - 执行步骤动作（发消息/打标签/推素材等）
   - 更新执行进度
   ↓
4. 记录执行日志
   ↓
5. 完成/失败状态更新
```

## 依赖服务

- `message-service`: 消息发送
- `customer-service`: 客户数据和标签管理
- `integration-service`: 第三方平台集成
- MySQL: 数据存储
- Redis: 缓存和分布式锁
- Bull: 任务队列

## 注意事项

1. **SOP执行**
   - 延时任务应使用队列实现（Bull）
   - 注意并发控制
   - 失败重试机制

2. **群发任务**
   - 控制批次大小避免过载
   - 注意发送频率限制
   - 记录详细的执行日志

3. **性能优化**
   - 使用队列处理异步任务
   - 批量操作分批执行
   - 合理设置延迟时间

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- SOP模板管理
- SOP执行引擎
- 群发任务管理
- 自动化触发支持

