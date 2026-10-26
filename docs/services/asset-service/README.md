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
- **数据库**: PostgreSQL
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
DB_PORT=5432
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
- PostgreSQL: 数据存储

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 素材上传和管理
- 分类管理
- 使用统计



## 写入边界与事务（2026-10-26）

素材详情/更新/删除与分类更新/删除均从URL路径读取`id`，拒绝前导零、指数、十六进制、尾字符和非正数。素材编号支持到JS正安全整数上界，分类编号为正INT32。JSON分类引用与使用素材编号须为整数，分类父级0保留根语义；列表查询保留URL数字字符串转换。

素材上传在读文件/调用OSS前校验分类存在且属当前企业，落库事务再校验并持分类共享行锁；更新同样校验分类与目标素材。分类父级必须同企业存在，企业级事务锁串行化层级变更，拒绝自指、间接成环；仍有子分类/素材引用时不能删除分类。省略编辑字段保持原值。

使用记录先锁定本企业素材，使用记录和原子计数在同一事务提交；记录/计数任一失败整体回滚，不接受不存在或外企素材。历史使用日志保留语义不变，本批未增加素材删除后的日志级联。

验证见[素材修复报告](../../tests/2026-10-26-asset-write-integrity.md)。当前服务路径仍为`/api/asset`与`/api/asset-category`；网关接入已在后续独立修复完成：素材`/api/v1/assets/*`与优先分类`/api/v1/assets/categories/*`映射上述服务路径，旧服务路径也可经网关鉴权。详情见[网关验证](../../tests/2026-10-26-asset-gateway-routing.md)。真实OSS上传、存储成功后数据库失败的对象补偿以及真实凭据配置仍未验收。


## 上传读取、网关与补偿（持续推进批次）

当前Midway文件模式将临时路径放在`file.data`；服务读取该路径，保留直接调用的`filepath`兼容。只接受一个文件，multipart字段只允许name/type/categoryId/tags；type必须为规范1/2/3字符串，tags是JSON字符串数组，身份字段不可由表单指定。输入与配置类型不符400、超过类型大小限制413，均在OSS调用前拒绝。AVI/MOV同时支持实际MIME别名`video/x-msvideo`与`video/quicktime`；这是扩展名/声明类型与配置校验，不冒充恶意内容或病毒扫描。

受保护的两上传入口保留真实multipart boundary和二进制原文，网关先在私有临时文件中校验实际总字节，再转发；整个封装最多101MiB，素材文件仍受10/100/50MiB的原类型上限约束。上传上游超时120秒，覆盖OSS默认60秒超时；网关不自动重试。普通JSON请求仍30秒。落盘需要临时磁盘，尚无全局并发磁盘配额，强杀后的临时文件维护仍需部署方安排。

每次上传使用UUID对象键。OSS返回失败但可能已写入，或数据库事务callback在提交前失败，都会尝试删除该唯一键；失败不能删掉其它成功上传。若callback完成而COMMIT结果未知，不删除可能已被提交素材引用的对象，记录`asset-upload-reconciliation-required`及对象键。补偿删除失败也记录该事件并保留原错误。临时文件清理失败仅记录维护事件，不把已经提交的成功变成失败。

服务端输入错误以400/413返回；存储/数据库错误仍沿用现有HTTP200+`success:false`形状，调用者必须检查success。该补偿不是跨OSS/PG的原子事务；COMMIT未知或双故障仍需对账，尚未新增持久补偿队列。真实云OSS和凭据仍未验收。当前实际SDK+本地HTTP存储替身证据见[上传存储报告](../../tests/2026-10-26-upload-storage-recovery.md)。
