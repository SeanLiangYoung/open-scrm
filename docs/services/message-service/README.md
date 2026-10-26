# Message Service - 消息服务

## 概述

消息服务提供消息模板、发送日志、显式Mock模拟及独立站内通知。企微、短信、邮件提供方尚未接通。

### 当前渠道能力（2026-10-26）

发送器仅接受 `messageType:5` 作为明确模拟，不会真实送达。单发、批量和模板发送遇到1/2/3/4返回400“消息渠道尚未接通”，不创建新的成功日志。类型2曾是空返回占位，它不等于独立NotificationService的真实站内通知接口；通知API继续可用。

v1发送入口在同意查询及Redis营销额度消耗前检查渠道能力，因此未接通渠道不会因缺少同意或静默/额度状态被误报为另一种失败，也不会消耗发送额度。Mock5仍经过既有同意和频控闸门。

历史幂等记录不改写；请求渠道和已有记录渠道均须为5才能重放，不能用Mock请求把旧占位成功重新解释为送达。失败重试只处理本企业失败日志，未接通渠道仍保持失败并记录原因。历史成功数可能含旧占位和Mock，不能称真实送达率。单元红绿已验证，完整真实HTTP证据见[渠道能力报告](../../tests/2026-10-26-message-capability-http.md)，执行中状态须以报告为准。

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
- 仅显式Mock5可模拟发送成功；渠道1至4尚未接通，发送会明确失败

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
- **数据库**: PostgreSQL
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

### 客户营销同意记录（2026-10-25）

统一网关路径新增：

- `POST /api/v1/messages/consents/grant`：记录一条新的营销授权证据。
- `POST /api/v1/messages/consents/revoke`：撤回该企业客户全部尚有效的营销授权。

两个接口必须经认证网关访问。企业和操作者来自网关覆盖写入的 `x-corp-id` / `x-user-id`，或服务已验证的 `ctx.state.user`；缺少完整有效身份返回 401，不使用开发环境默认企业。消息服务端口属于内部可信网络，不能暴露给可伪造身份头的客户端。

授权请求示例：

```json
{
  "customerId": 7,
  "purpose": "marketing",
  "policyVersion": "privacy-v1",
  "channel": "web",
  "locale": "th-TH"
}
```

`customerId` 必须为 JSON 正安全整数；当前目的仅支持 `marketing`。授权必须提供非空且不超过 64 字符的 `policyVersion`、渠道 `web | line_oa | whatsapp | email | other`、不超过 16 字符的有效 BCP-47 `locale`。请求体严格拒绝额外字段（含 `corpId`、`userId`），无效参数返回 400。

撤回请求为 `{"customerId":7,"purpose":"marketing"}`，成功响应 `{"success":true,"data":{"revokedCount":2}}`；重复撤回返回 `revokedCount: 0`。授权成功返回 `{"success":true,"data": <consent_record 实体>}`。不存在或不属于当前企业的客户统一返回 404。每次授权新增证据，撤回只写 `revoked_at`，保留文案版本、渠道、locale 和 `created_at`；客户撤回后可以再次明确授权。

当前部署使用共享 PostgreSQL。授权和撤回在事务内通过带企业条件的 `customer` 行锁串行处理，不需要新增表或修改初始化脚本。已完成撤回后的新 `POST /api/v1/messages/send` 请求，若声明 `consentPurpose=marketing`，会在区域配额和渠道调用前返回 403。此保证不取消已通过检查并在执行中的发送，也不覆盖旧 `/api/message/*` 入口或未声明营销目的的请求；这是当前 API 的工程边界，并非法律合规结论。实际授权主体核验、操作者审计字段和完整撤回历史仍需后续设计。

验证：服务目录执行 `./node_modules/.bin/vitest run`、`./node_modules/.bin/tsc --noEmit` 和 `./node_modules/.bin/mw build`。闭环单测覆盖多次授权全部撤回、重复撤回、再次授权、企业隔离、身份与参数验证，以及撤回后发送被拦截。

独立网关 E2E 只在一次性数据库/客户上显式启用（不会调用真实渠道，发送使用 `messageType: 5`）：

```bash
cd code/e2e
CONSENT_E2E_DISPOSABLE=1 CONSENT_E2E_CUSTOMER_ID=<专用测试客户ID> \
  GATEWAY_URL=http://127.0.0.1:17000 \
  ./node_modules/.bin/playwright test --project consent-lifecycle --grep '^consent grant'
```

该用例需要 gateway、auth、message 服务、PostgreSQL 和 Redis；测试客户必须属于测试登录账号所在企业且专供本用例使用。未显式启用时跳过；启用后任何依赖错误均失败，不伪装通过。它校验匿名拒绝、身份字段注入拒绝、不存在客户 404、授权两次、Mock 发送、撤回两条、403 拦截及重复撤回；完成或失败时会撤回该测试客户剩余营销授权。真实数据库端到端验证情况见当次执行报告。

### 统一发送 API 的幂等重放（2026-10-26）

`POST /api/v1/messages/send` 支持 `Idempotency-Key` 请求头及 `idempotencyKey` 请求体字段。两者同时存在且不同则返回400；同企业/同键重试返回首次日志及首次内容，不再次发送。相同键在不同企业分别存储，不跨企业重放。

PostgreSQL bigint 企业ID水合为字符串时，比较器现在与可信安全整数身份进行规范十进制精确比较，不通过Number转换大整数字符串。比较器拒绝不明确或不安全身份表示。消息服务78项单测和隔离真实网关3项E2E通过；实际重试返回原日志ID，数据库每企业只保留一条Mock记录。完整执行与边界见[验证报告](../../tests/2026-10-26-message-idempotency-http.md)。这些测试只发送类型5，未验证外部消息渠道。

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

#### 通知接收人边界（2026-10-26）

创建通知先验证整个接收人批次：`userIds`支持单个数字或数组，必须为非空正安全整数集合，重复ID去重。全部员工都必须在共享`user`表中属于当前企业且`status=1`；缺失、外企、停用或非法目标统一400，任何一个无效都会拒绝整批，不保存其余有效接收人的通知。

校验与保存使用同一事务和事务仓库，员工行持有共享锁直至批次提交；保存失败整批回滚。成功契约保持`{success:true,data:{success:true,count},message}`，count为去重后的实际条数。title、content、notificationType、linkUrl、extra和expireDays保留既有语义。数据库/内部服务调用也执行该校验，不能仅依赖前端员工选择。

消息服务98项单测及独立真实PG6项检查通过，包含混合批次无写入、插入失败回滚和员工停用锁时序。复现命令与准确范围见[验证报告](../../tests/2026-10-26-notification-recipients-postgres.md)。这些验证没有外部发送；PG检查直接调用服务，不表示网关认证已在该脚本内测试。

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
DB_PORT=5432
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
- PostgreSQL: 消息数据存储
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


### 失败重试企业隔离（2026-10-26）

`POST /api/message/retry` 必须经网关提供完整企业与操作者身份，缺失身份401，不回退默认企业。`logIds`接受正安全整数数字标量或1至100项数字数组（不接受数字字符串），重复ID只处理一次；无效输入400。查询只处理当前企业失败记录，外企、不存在或已成功记录不返回细节、不重发。响应结构保持。完整消息服务128项测试和一次性PG16真实网关八组验证通过，外部发送仅使用Mock5，清理已确认。详见[验证报告](../../tests/2026-10-26-message-retry-isolation.md)。

### 客户营销授权证据只读快照（2026-10-26）

`GET /api/v1/messages/consents/customer/:customerId?page=1&pageSize=20`读取当前企业客户的marketing证据。要求完整可信企业/操作者身份，缺失401；非法客户编号/分页或未知、重复query400，外企及不存在客户404。customerId限规范十进制正安全整数，page1至100000、pageSize1至100。

响应data包含字符串customerId、固定purpose、数据库observedAt、hasActiveMarketingConsent、全量activeCount/revokedCount/total、page/pageSize/list。list仅id字符串、purpose、policyVersion、channel、locale、createdAt、revokedAt，旧证据null不补造。统计和分页在READ ONLY REPEATABLE READ同一manager事务内读取；不同分页请求各有新快照，observedAt不是持续实时保证。未撤回记录只代表当前内部证据状态，不证明法律合规或真实外部送达。

新增39项单元通过，完整消息服务197项通过；真实PG16六组验证含并发grant/revoke屏障，真实网关双企业14组通过、最终SQL精确4证据行和1显式Mock日志，清理已确认。详情见[验证报告](../../tests/2026-10-26-consent-read-model.md)。

### 模板引用与路径编号边界（2026-10-26）

模板详情/更新/删除、legacy与v1日志详情路径只接受规范十进制正安全整数；畸形或超安全编号400，不再parseInt截断/舍入。可选发送templateId若出现必须JSON正安全数字，同企业存在才可引用；非法格式400，不存在/外企统一404，并在v1授权/日额度与幂等之前拒绝，单发/批量服务同样保护。其他既有发送DTO错误保留422。

引用仅记录来源，不渲染或替换explicit content，不额外要求模板启用或渠道一致；独立按模板发送接口仍保留原本启用/渲染规则。未接通渠道限制不变，成功验证仅Mock5。新增80项回归及局部middleware9项通过，完整消息服务286项单元/类型检查通过，隔离真实网关双企业13组与启动失败清理自检通过，SQL无跨企业引用。详见[验证报告](../../tests/2026-10-26-message-template-integrity.md)。

模板ID范围补充：当前message_template为PostgreSQL SERIAL/int4，因此模板路径与引用只支持1..2147483647，超范围400；日志bigint编号仍支持正安全整数至MAX_SAFE。实际先证实原实现六次22003/500，再修复；最终304单元/tsc及扩展真实双企14组通过，旧13组证据保留，详情见上述完整性报告。

### 通知接收人与已读编号严格数字（2026-10-26）

CreateNotificationDto.userIds与MarkReadDto.notificationIds仅接受JSON正安全整数数字标量，或1至100项同规则数字数组，不接受数字/指数/十六进制字符串、空数组、嵌套数组、布尔、非正、小数或unsafe值。身份列为bigint，合法MAX_SAFE数字仍可使用，不受模板int4限制。其他字段与默认DTO422不变，合法数字但外企接收人仍服务400、整批不写。

58项独立DTO测试、完整消息服务362项及tsc通过；新隔离真实网关12组（含46非法请求422、MAX_SAFE实际接收与已读、100项、跨企）和故障清理自检通过，最终SQL8通知/0message。详见[验证报告](../../tests/2026-10-26-notification-id-dto-review.md)。
