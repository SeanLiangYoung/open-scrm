# Customer Service - 客户管理服务

客户信息管理、标签管理、客户画像等核心功能服务。

---

## 📋 服务信息

| 信息 | 值 |
|------|-----|
| **服务名称** | customer-service |
| **端口** | 7002 |
| **数据库** | PostgreSQL (`scrm_dev`，与全库共用) |
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

### 3. 范围与边界
- CSV导入/导出入口已有实现，不能仅因接口存在宣称其全部格式和失败路径已验收。
- 客户画像、分组等早期设计不作为本轮已交付能力。
- 当前文档下列模型为主要列摘要，完整类型与约束以实体和初始化SQL为准。

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
| type | SMALLINT | 1-微信 2-企微 |
| gender | SMALLINT | 0-未知 1-男 2-女 |
| follow_user_id | BIGINT | 跟进员工ID |
| channel | VARCHAR(50) | 添加渠道 |
| status | SMALLINT | 0-已删除 1-正常 2-流失 |
| create_time | TIMESTAMP | 创建时间 |

### 标签表 (customer_tag)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| corp_id | BIGINT | 企业ID |
| tag_name | VARCHAR(50) | 标签名 |
| tag_type | SMALLINT | 1-来源 2-行为 3-兴趣 4-价值 |
| tag_color | VARCHAR(10) | 标签颜色 |
| parent_id | INT | 父标签ID |
| sort | INT | 排序 |
| is_auto | SMALLINT | 是否自动打标签 |

---

## 🚀 API接口

### 跟进记录企业隔离（2026-10-25）

- `POST /api/v1/follow-ups`：企业与操作者来自网关转发身份（或服务侧已验证的 `ctx.state.user`）；忽略正文中的 `corpId` / `userId`。缺少有效身份返回 401，不再使用企业 1 的开发默认值。
- `GET /api/v1/follow-ups/customer/:customerId`：先验证客户属于当前企业，再按 `customerId + corpId` 查询。其他企业或不存在的客户均返回 404。
- 两个入口均验证客户归属。ID 必须为安全正整数；列表 `page >= 1`、`1 <= pageSize <= 100`，非法参数返回 400。
- 创建正文必须为 JSON 对象；`content` 必须为非空白字符串（保留原内容），`followType` 为数字枚举 1–4，省略时默认 1。`nextFollowTime` 可省略或为 null，否则使用 UTC ISO 格式 `YYYY-MM-DDTHH:mm:ss[.SSS]Z`（与前端 Date JSON 序列化一致），不存在的日历日期也返回 400。
- ID / 分页字符串只接受十进制正整数字面量，拒绝指数、十六进制、空格与小数格式；计算后的分页偏移也必须在安全整数范围内。这些输入在客户查询与记录保存之前校验，避免无效请求落到数据库错误。
- 依赖部署边界：业务服务应只接受可信网关/内部调用；这些头本身不是签名凭证。此修复不代表全系统已完成直连服务认证或全部接口的企业隔离审计。
- 回归已纳入根 `test:unit`。另有[真实多企业跟进HTTP](../../tests/2026-10-26-customer-http.md)和[真实客户UI](../../tests/2026-10-26-customer-real-ui.md)证据；它们使用独立PG16，不等于真实多企业生产部署或全部客户接口审计。
- PostgreSQL 运行时：跟进实体已将旧 MySQL `tinyint/datetime` 改成 `smallint/timestamp`，并增加无需连库的全实体 metadata 验证。新库初始化新增 `customer_follow_up`；已有数据卷需由维护者执行 `code/scripts/migrations/2026-10-25-customer-follow-up.pg.sql`（本次未对既有数据库自动执行）。这避免仅依赖开发环境 `synchronize`，生产配置不会自动建表。

### 客户员工选择、取消分配与可空字段（2026-10-26）

- 创建/更新的数字 `followUserId` 在保存前以参数化查询检查共享PostgreSQL `"user"`：必须是本企业且 `status=1` 的员工；有效数字对应不存在、外企或停用员工时，业务校验400，不保存或改写原分配。前端选择器不能代替这层权威检查。
- 省略字段：创建保持未分配；更新保留原分配，不因修改姓名重验或清除既有员工。**更新显式 `followUserId: null` 取消分配**，仍先验证客户属于当前企业；创建不接受null。员工校验是保存前状态检查，不是阻止其他请求以后停用员工的数据库约束。
- `mobile: null` / `remark: null` 清空对应列，省略表示不修改；更新的这三列允许明确null，其他字段没有一起扩展null契约。非空手机号仍按现有规则校验，空字符串不是清空指令。各DTO路由的非法格式状态遵循其现有校验层，不把手写业务400扩大成全局统一错误码。
- 运营客户表单现已使用本企业 `GET /api/v1/staff` 远程选择单员工。新建未选不默认员工1，改选提交安全数字；编辑不变时省略，主动清空原选择发送null。未出现在当前搜索页的原员工仍保留标签。来源仅创建可改，手机号/备注明确清空发送null；创建不携带硬编码企业、旧source或不存在的email持久化字段。
- 初版[分配与表单报告](../../tests/2026-10-26-customer-assignment.md)记录75项单测/4项Mock浏览器/13项PG检查的历史快照；此后新增取消分配的实际PostgreSQL保存/读取和Mock请求断言，旧报告不回写成最新总数。复现 `code/scripts/test/overnight-customer-assignment-postgres.sh`，当次检查数量以输出为准。
- [真实客户浏览器3项](../../tests/2026-10-26-customer-real-ui.md)已经验证登录、新建、跟进持久化/失败草稿保留及真实员工目录选择后的客户分配，PG16确认两个客户、一个有效跟进、零消息。该三项没有执行取消分配，不把已新增语义当作已覆盖的真实UI场景。

### 状态库存口径

`GET /api/v1/customers/statistics/overview` 的 `active` 是当前status1正常库存，`lost` 是当前status2流失库存；均不是行为活跃或当日状态变化事件。status0为软删除，历史记录仍在库中。analytics日表旧 `lostCustomerCount` 则映射status0已删除库存，准确字段为 `deletedCustomerCount`，两处字段不能按字面混为同一指标。历史快照/回填和区间末日语义见[分析服务](../analytics-service/README.md)。

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
# PostgreSQL（与 monorepo 其他服务共用同一库时常用）
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=root123
DB_DATABASE=scrm_dev

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 默认服务端口7002，由当前koa配置决定；不要假定PORT环境变量能覆盖
```

---

## 📦 依赖服务

| 服务 | 用途 |
|------|------|
| PostgreSQL 16 | 数据存储 |
| Redis 7.0 | 缓存 |
| auth-service | 用户认证 |

---

## 🔗 相关文档

- [开发计划.md](../../开发计划.md)
- [仓库 README](../../../README.md)
- [快速开始](../../guides/快速开始.md)

---

**创建时间**: 2025-10-28  
**事实同步**: 2026-10-26；范围内验证不代表全部客户功能或生产部署完成。

## 创建与标签写入边界（2026-10-26）

带非空tagIds创建客户时，在同一事务中核对并锁定本企业全部标签，客户及关系一起保存；外企/缺失标签或关系数据库保存失败均不留下客户。无标签与空数组保持原创建契约。followUserId仅接受JSON正安全整数，更新可显式null清除；tagIds仅接受1–2147483647的JSON整数数组，最多100项，重复归一。客户CRUD原始路径须规范正安全整数字符串，拒绝指数、十六进制、尾随字符等隐式转换。

标签create/update/batch使用不可变企业/主键白名单，同企业父级及环路检查，事务全批提交；按企业事务advisory锁覆盖服务的create/update/batch/delete，防止检查后同名并发写入。未新增数据库唯一约束，不修复历史同名/损坏行，也不保证绕过服务的直接SQL。客户addTags核对完整集合后整体写入，不静默部分成功。详见tag-integrity、tag-name-concurrency与customer-input-http验证报告。
