# Asset Service - 素材管理服务

## 概述

素材管理服务负责企业素材库的完整管理，包括素材上传、分类管理、使用统计等功能。

## 核心功能

### 1. 素材管理
- 素材上传（图片、视频、文件）
- 素材编辑（名称、分类、标签）
- 素材删除
- 素材查询和搜索

### 2. 分类管理
- 创建分类
- 编辑分类
- 删除分类
- 树形分类结构

### 3. 使用统计
- 使用记录跟踪
- 使用次数统计
- 使用场景分析

### 4. 文件存储
- OSS云存储
- CDN加速
- 缩略图生成
- 文件大小限制

## 技术栈

- **框架**: Midway.js
- **ORM**: TypeORM
- **数据库**: MySQL
- **缓存**: Redis
- **文件存储**: OSS
- **文件上传**: @midwayjs/upload

## API 接口

### 素材管理

#### 上传素材
```http
POST /api/asset/upload
Content-Type: multipart/form-data

{
  "file": [文件],
  "name": "素材名称",
  "type": 1,
  "categoryId": 1,
  "tags": ["标签1", "标签2"]
}
```

#### 查询素材列表
```http
GET /api/asset/list?name=关键词&type=1&categoryId=1&page=1&pageSize=20
```

响应示例：
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "name": "产品图片",
        "type": 1,
        "fileUrl": "https://cdn.example.com/xxx.jpg",
        "fileSize": 102400,
        "mimeType": "image/jpeg",
        "width": 800,
        "height": 600,
        "useCount": 15,
        "createTime": "2025-10-28T12:00:00.000Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

#### 获取素材详情
```http
GET /api/asset/:id
```

#### 更新素材
```http
PUT /api/asset/:id
Content-Type: application/json

{
  "name": "新名称",
  "categoryId": 2,
  "tags": ["新标签"]
}
```

#### 删除素材
```http
DELETE /api/asset/:id
```

#### 记录使用
```http
POST /api/asset/usage
Content-Type: application/json

{
  "assetId": 1,
  "useType": "message",
  "refId": 123
}
```

### 分类管理

#### 创建分类
```http
POST /api/asset-category
Content-Type: application/json

{
  "name": "产品图片",
  "parentId": 0,
  "sort": 1
}
```

#### 获取分类树
```http
GET /api/asset-category/tree
```

响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "图片",
      "parentId": 0,
      "sort": 1,
      "assetCount": 50,
      "children": [
        {
          "id": 2,
          "name": "产品图片",
          "parentId": 1,
          "sort": 1,
          "assetCount": 30,
          "children": []
        }
      ]
    }
  ]
}
```

#### 获取分类列表
```http
GET /api/asset-category/list
```

#### 更新分类
```http
PUT /api/asset-category/:id
Content-Type: application/json

{
  "name": "新名称",
  "sort": 2
}
```

#### 删除分类
```http
DELETE /api/asset-category/:id
```

## 支持的文件类型

### 图片 (type: 1)
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- 最大 10MB

### 视频 (type: 2)
- MP4 (.mp4)
- AVI (.avi)
- MOV (.mov)
- 最大 100MB

### 文件 (type: 3)
- PDF (.pdf)
- Word (.doc, .docx)
- 最大 50MB

## 环境配置

```env
PORT=7005
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=open_scrm

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# OSS配置
OSS_ACCESS_KEY_ID=xxx
OSS_ACCESS_KEY_SECRET=xxx
OSS_BUCKET=xxx
OSS_ENDPOINT=xxx
OSS_PREFIX=scrm-assets

# CDN域名（可选）
CDN_DOMAIN=https://cdn.example.com
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

## 使用场景

1. **消息发送**: 选择素材库中的图片、视频发送给客户
2. **SOP配置**: 在SOP流程中引用素材
3. **群发任务**: 批量发送时使用素材
4. **内容发布**: 发布到抖音、小红书等平台

## 依赖服务

- OSS: 文件存储
- Redis: 缓存
- MySQL: 数据存储

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 素材上传和管理
- 分类管理
- 使用统计

