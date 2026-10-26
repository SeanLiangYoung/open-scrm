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
- **数据库**: PostgreSQL
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

### 内容草稿与发布（创作中心）

#### 创建草稿
```http
POST /api/v1/acquisition/contents
Content-Type: application/json

{
  "accountId": 1,
  "platform": "xiaohongshu",
  "contentType": 1,
  "title": "标题",
  "content": "正文",
  "topics": ["AI"]
}
```

#### 发布草稿（小红书 MVP）
```http
POST /api/v1/acquisition/contents/:id/publish
```

#### 查询发布状态
```http
GET /api/v1/acquisition/contents/:id/publish-status
```

#### 本地开发：绑定平台 OAuth Token
```http
POST /api/platform-account/:id/oauth
Content-Type: application/json

{
  "accessToken": "dev-token"
}
```

内容状态：`0` 草稿 · `3` 发布中 · `1` 已发布 · `2` 失败。本地默认 `XHS_PUBLISH_MODE=mock`。

## 环境配置

```env
PORT=7003
DB_HOST=localhost
DB_PORT=5432
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

# 小红书发布（创作中心 P3）
XHS_PUBLISH_MODE=mock
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
- PostgreSQL: 数据存储
- Redis: 缓存
- OSS: 文件存储

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 平台账号管理
- 渠道活码功能



## 扫码写入可靠性（2026-10-26）

`/api/v1/acquisition/channel-codes/:id`、`/:id/scan-touches/latest` 与 `/:id/ingest-scan` 的编号须为规范十进制正整数，最大2147483647（对应 PostgreSQL INTEGER）；前导零、小数、指数、尾随字符或越界返回400，不截断。

扫码在 PostgreSQL 同一事务中，以 `{corpId,id}` 锁定活码行，再更新计数、保存可选24小时幂等凭据及归因记录。存在的幂等凭据也在该事务内加写锁并持有至提交，避免TypeORM续期保存期间被过期清理删除；维护清理使用SKIP LOCKED跳过该记录。同活码并发不同事件不丢计数，同企业/活码/`externalEventId` 的重复事件返回 `replayed=true`；不同企业或活码不共用凭据。无 `externalEventId` 的每次成功请求均计数，不能保证客户端网络丢响应后的无凭据重试去重。归因写入失败现在整体回滚并允许重试，不再吞异常后报告部分成功。事件凭据不写入归因占位表，也不改变最近归因查询结果。

既有数据库须先执行 [`2026-10-26-channel-scan-event.pg.sql`](../../../code/scripts/migrations/2026-10-26-channel-scan-event.pg.sql)，可重复执行；新库的 canonical 初始化也包含该表/索引。新 `ChannelScanEventEntity` 由现有 entity glob 自动发现，`synchronize:false` 仍要求初始化/迁移先完成。已有 Redis 去重键不再作为依据；升级切换窗口内，旧实现已接受的事件可能重计一次，需停写切换或在业务端避免重放该窗口，不能声称跨旧/新凭据存储仍有无缝幂等。

24小时以获得活码锁后的数据库时间计算，不延长重复事件的有效期。业务事务提交成功后，以独立 autocommit 最多删除1000条全局过期凭据，使用到期索引与 `SKIP LOCKED`，清理期间不持有活码锁。维护失败记录告警，不能把已提交的计数变成失败响应；此时应重试维护并监控表大小。停止扫码的闲时不会自动清表，可按迁移末尾的有界 DELETE 定时/人工重复至0行，避免过期凭据长期堆积；当前未增加后台调度器。逻辑到期不依赖清理成功。

验证命令与真实结果见 [扫码可靠性验收](../../tests/2026-10-26-channel-scan-reliability.md)：服务单测47项、类型检查、独立PG16十三组通过；该证据没有真实渠道发送、Bootstrap或HTTP验收。
