# Customer Service - 客户管理服务

客户信息管理、标签管理、客户画像等核心功能服务。

---

## 📋 服务信息

| 信息 | 值 |
|------|-----|
| **服务名称** | customer-service |
| **端口** | 7002 |
| **数据库** | MySQL (scrm_customer) |
| **缓存** | Redis (db1) |

---

## 🎯 核心功能

### 1. 客户管理
- ✅ 客户CRUD（创建、查询、更新、删除）
- ✅ 客户列表查询（分页、筛选、搜索）
- ✅ 客户详情查看
- ✅ 客户统计分析

### 2. 标签管理
- ✅ 标签CRUD
- ✅ 标签树形结构
- ✅ 批量创建标签
- ✅ 客户打标签/移除标签

### 3. 高级功能
- ⏳ 客户画像
- ⏳ 批量导入客户
- ⏳ 导出客户数据
- ⏳ 客户分组

---

## 📊 数据模型

### 客户表 (customer)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键 |
| corp_id | BIGINT | 企业ID |
| external_userid | VARCHAR(100) | 企微外部联系人ID |
| name | VARCHAR(100) | 姓名 |
| mobile | VARCHAR(20) | 手机号 |
| avatar | VARCHAR(255) | 头像 |
| type | TINYINT | 1-微信 2-企微 |
| gender | TINYINT | 0-未知 1-男 2-女 |
| follow_user_id | BIGINT | 跟进员工ID |
| channel | VARCHAR(50) | 添加渠道 |
| status | TINYINT | 0-已删除 1-正常 2-流失 |
| create_time | DATETIME | 创建时间 |

### 标签表 (customer_tag)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| corp_id | BIGINT | 企业ID |
| tag_name | VARCHAR(50) | 标签名 |
| tag_type | TINYINT | 1-来源 2-行为 3-兴趣 4-价值 |
| tag_color | VARCHAR(10) | 标签颜色 |
| parent_id | INT | 父标签ID |
| sort | INT | 排序 |
| is_auto | TINYINT | 是否自动打标签 |

---

## 🚀 API接口

### 客户相关

**创建客户**
```http
POST /api/v1/customers
Content-Type: application/json

{
  "externalUserid": "wmxxxx",
  "name": "张三",
  "mobile": "13800138000",
  "channel": "活动推广"
}
```

**查询客户列表**
```http
GET /api/v1/customers?page=1&pageSize=20&keyword=张三&status=1
```

**获取客户详情**
```http
GET /api/v1/customers/:id
```

**更新客户**
```http
PUT /api/v1/customers/:id
Content-Type: application/json

{
  "name": "张三",
  "mobile": "13800138000"
}
```

**删除客户**
```http
DELETE /api/v1/customers/:id
```

**为客户添加标签**
```http
POST /api/v1/customers/:id/tags
Content-Type: application/json

{
  "tagIds": [1, 2, 3]
}
```

**移除客户标签**
```http
DELETE /api/v1/customers/:id/tags/:tagId
```

**客户统计**
```http
GET /api/v1/customers/statistics/overview
```

### 标签相关

**创建标签**
```http
POST /api/v1/tags
Content-Type: application/json

{
  "tagName": "VIP客户",
  "tagType": 4,
  "tagColor": "#FF0000"
}
```

**查询标签列表**
```http
GET /api/v1/tags?keyword=VIP&tagType=4
```

**获取标签树**
```http
GET /api/v1/tags/tree
```

**更新标签**
```http
PUT /api/v1/tags/:id
```

**删除标签**
```http
DELETE /api/v1/tags/:id
```

---

## 🛠️ 开发指南

### 安装依赖

```bash
cd services/customer-service
pnpm install
```

### 本地开发

```bash
# 启动开发服务器
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm type-check
```

### 环境变量

```bash
# MySQL配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=scrm
MYSQL_PASSWORD=scrm_password
MYSQL_DATABASE=scrm_customer

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 服务端口
PORT=7002
```

---

## 📦 依赖服务

| 服务 | 用途 |
|------|------|
| MySQL 8.0 | 数据存储 |
| Redis 7.0 | 缓存 |
| auth-service | 用户认证 |

---

## 🔗 相关文档

- [开发计划表](../../../开发计划表.md)
- [主README](../../../README.md)
- [快速开始](../../快速开始.md)

---

**创建时间**: 2025-10-28  
**状态**: ✅ 基础功能完成
