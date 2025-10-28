# Acquisition Service - 获客服务

## 概述

获客服务负责公域引流到私域的全流程管理，包括平台账号管理、内容发布、渠道活码生成和引流数据统计。

## 核心功能

### 1. 平台账号管理
- 抖音/小红书账号授权
- Token管理和自动刷新
- 账号状态监控

### 2. 内容发布
- 图文内容发布
- 视频内容发布
- 草稿箱管理
- 定时发布

### 3. 渠道活码
- 活码生成
- 多员工分流
- 自动打标签
- 欢迎语配置

### 4. 引流数据统计
- 扫码次数统计
- 添加客户数统计
- 渠道转化率分析

## 技术栈

- **框架**: Midway.js
- **ORM**: TypeORM
- **数据库**: MySQL
- **缓存**: Redis
- **文件存储**: OSS
- **二维码**: qrcode

## API 接口

### 平台账号

#### 创建账号
```http
POST /api/platform-account
Content-Type: application/json

{
  "platform": "douyin",
  "accountName": "品牌官方账号",
  "accessToken": "xxx",
  "refreshToken": "xxx"
}
```

#### 查询账号列表
```http
GET /api/platform-account/list?platform=douyin&page=1
```

### 渠道活码

#### 创建活码
```http
POST /api/channel-code
Content-Type: application/json

{
  "codeName": "抖音渠道活码",
  "channel": "douyin",
  "staffIds": [1, 2, 3],
  "welcomeMsg": "欢迎关注！",
  "autoTagIds": [1, 2]
}
```

#### 查询活码列表
```http
GET /api/channel-code/list?channel=douyin&page=1
```

## 环境配置

```env
PORT=7003
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=open_scrm

# OSS配置
OSS_ACCESS_KEY_ID=xxx
OSS_ACCESS_KEY_SECRET=xxx
OSS_BUCKET=xxx
OSS_ENDPOINT=xxx

# 依赖服务
CUSTOMER_SERVICE_URL=http://localhost:7002
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

## 依赖服务

- `integration-service`: 企业微信活码生成
- `customer-service`: 客户数据管理
- MySQL: 数据存储
- Redis: 缓存
- OSS: 文件存储

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 平台账号管理
- 渠道活码功能

