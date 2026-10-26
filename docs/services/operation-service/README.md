# Operation Service - 运营服务

## 持久 SOP 调度（2026-10-26，当前契约）

执行由 PostgreSQL 保存触发时的启用步骤快照、绝对截止时间和带 token 的租约；服务启动后按短周期扫描到期记录，不再为每个步骤创建长时间 Node timer。`currentStep` 仍表示已完成步骤数，状态仍为 0运行/1完成/2暂停/3失败或取消。30天到365天的合法延迟保存为数据库时间，下一个步骤从前一步确认完成时起算。

暂停保留已保存的绝对截止时间，时间继续流逝；恢复时已经到期的步骤可立即被领取。恢复仍要求本企业原模板存在、启用且目标类型一致，但执行内容使用原快照，模板修改不会改写已经触发的步骤。最后一个在途动作确认成功时可以保存进度并保留暂停状态；之后恢复直接完成，不重发该动作。取消后不会领取后续步骤；动作开始标记提交后的在途请求无法撤回。

领取通过短事务 `FOR UPDATE SKIP LOCKED` 和随机 token 在多进程间互斥；动作前持久化开始标记，动作后用 token 条件更新进度/日志/下一截止时间。失效的旧 token 不能推进执行。扫描和并发均有上限，默认 `operation.sop.pollMs=1000`、`maxConcurrent=10`、`leaseMs=90000`，动作请求超时30秒；心跳不重叠续租。配置无效时回退上述边界内默认值。

**恢复边界**：执行者退出后，尚无动作开始标记的过期领取可以重新领取。已经提交开始标记而没有确认结果的过期领取会记为3，并明确标记“结果未知、禁止自动重放”；即使实际请求尚未发出，也优先避免重复副作用。HTTP请求抛错或业务确认失败同样停止；不会使用原先未实现的retryTimes/retryDelay自动重发。暂停中请求失败先保留暂停/原失败证据，但没有下一截止时间，恢复或下一轮扫描会终止为3，不重复动作。暂停/取消中的未完成请求若租约失效也会停止并注明结果未知。

消息和素材请求增加 `sop:<executionId>:<stepNumber>` 的稳定幂等键，复用消息服务原有的企业+键去重。它不能解决消息服务发送后结果保存前的未知状态，也不代表供应商 exactly-once。通知、标签和客户分配没有新增跨服务幂等收据；本批通过未知动作停止来避免自动重放。进程长时间停顿后旧请求仍可能晚到，下游在途动作不能由数据库 token 撤回。

**升级**：先停止所有旧版operation-service进程，再由部署方审阅并执行 [`2026-10-26-durable-sop-scheduling.pg.sql`](../../../code/scripts/migrations/2026-10-26-durable-sop-scheduling.pg.sql)，然后启动新版。TypeORM `synchronize=false`，不能仅更新实体。不具备快照/可靠截止时间的旧0/2执行会保留已完成进度和日志并终止为3，附明确迁移原因，不猜测时间、不采用当前模板自动续跑。重跑迁移保护已经具有快照的完成中暂停记录和原动作失败证据。该任务仅在专用临时数据库执行迁移验证，没有升级业务数据库。

非法legacy模板动作触发时仍保留status3/currentStep0的失败执行记录，不发送副作用；新模板保存继续在原DTO/服务校验边界拒绝非法配置。自动触发事件、触发请求本身的幂等、真实第三方送达及全局并发额度不在本批范围。

验证命令、实际进程故障注入和已验证范围见[持久调度验证记录](../../tests/2026-10-26-durable-sop-scheduling.md)。以下历史章节保留当批事实；其中进程内timer、无快照及无多副本互斥的限制已由本节替代。

## 夜间可靠性补充（2026-10-26）

SOP执行目标 `1 客户 / 2 群` 与消息服务的 `1 客户 / 2 员工 / 3 群` 不同。发消息和推素材步骤将群目标明确转换为消息类型3，避免群ID被当作员工ID。单条发送必须收到消息服务明确确认：外层 `success=true`、内层 `success=1` 且 `failed=0`；HTTP200但发送失败、结果缺失或矛盾不能推进步骤，必须记录失败并停止后续步骤。主执行者先复现两项映射失败及九项错误成功，再修复；当前运营单测6文件/64项通过，类型检查通过，后续改动仍须重新验证。

群发取消路径现在要求安全的十进制正整数ID；指数、尾部字符、空白与超出JavaScript安全整数范围均在服务写入前返回400。前端执行/取消共用同一ID约束，避免PostgreSQL bigint字符串被宽松解析成另一任务ID。真实生产入口的网络信任边界保持原约定。

`tsconfig.json` 排除 `**/*.spec.ts`，防止生产构建扫描并加载Vitest测试模块。此前隔离运行发现服务构建能通过但启动因导入测试文件失败。正式build入口使用`mw build --clean`清理旧生成目录，避免排除规则已修正但旧spec仍残留；已实际放入陈旧spec产物，观察默认build保留它，再验证正式clean构建移除它。直接调用不带clean的CLI不能替代此构建入口。

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
- **数据库**: PostgreSQL
- **缓存**: Redis
- **执行方式**: PostgreSQL持久化截止时间/快照与有界租约worker；动作未知结果停止，不自动重放
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

### SOP 控制语义（2026-10-25历史，当前规则见上方持久调度契约）

- 执行器每步开始及延时结束后重新读取状态；暂停/取消后不再启动后续动作。
- 已经发给下游的请求不能撤回；其完成进度会被记录，但不会用旧对象覆盖暂停/取消状态。
- 恢复只接受本企业已暂停的记录，需要原模板存在且已启用。从 `currentStep` 后继续，不重放已完成步骤。原 worker 已停止时，未完成步骤重新开始完整延时；原 worker 仍在延时且已恢复时，沿用其当前等待，不创建重复计时器。
- 超过 Node 单次计时器上限（约24.8天）的延时拆成多段等待，避免30天等有效延时溢出后立即执行；仍是进程内等待，重启不会恢复剩余时间。
- 同一进程中的请求共享执行 guard，暂停/恢复与原 worker 交错时不创建第二条并行执行链。
- 现有状态码保持不变：0 执行中、1 完成、2 暂停、3 失败/取消终止。取消与失败的独立状态及 UI 区分仍为后续事项。
- **限制**：使用当前模板的启用步骤，尚无不可变执行快照；不支持多副本分布式互斥、进程崩溃后自动恢复或外部副作用的 exactly-once。不得以此宣称生产级长周期营销调度。模板自动触发与真实企微事件接入也未在本批交付。

回归在本服务执行 `pnpm test`，覆盖等待中暂停/取消、动作执行中控制、保存进度恢复、并发恢复及跨企业控制拒绝。2026-10-25 补充30天延时边界、长延时取消、终止记录重入、禁用模板恢复拒绝及跨请求实例 guard；服务单元测试共5个文件38项通过（执行控制15项、模板隔离及事务9项、控制器身份8项，其余工具6项），`tsc --noEmit` 与 `mw build` 通过。计时回归使用虚拟时钟及下游 mock，没有真实发送或操作项目数据库。

### SOP 企业隔离（2026-10-25）

- 所有 SOP 控制器入口要求有效企业与操作者身份，来自网关 `x-corp-id` / `x-user-id` 或服务验证的 `ctx.state.user`。缺失或歧义身份返回401，不再回退到企业1。
- 步骤列表和批量替换均先验证模板属于当前企业；拒绝后不会查询、删除或保存步骤。模板的跨企业更新与删除继续拒绝。
- 批量步骤只保存允许编辑的字段，嵌套 `id`、`templateId`、`status` 不参与写入；模板更新也不能改写 `id`、`corpId` 或创建者。
- 恢复等待旧执行链退出时，旧链异常会记录错误并继续从数据库已保存进度启动，避免接受恢复后遗留无执行链的运行中记录。
- 批量步骤替换在同一个 TypeORM 事务内读取并锁定本企业模板，再删除及保存步骤；保存失败会回滚并保留原步骤，针对同一模板的并发替换串行完成。允许编辑字段与企业归属检查保持生效。
- 真实数据库回归：仓库根运行 `code/scripts/test/overnight-sop-postgres.sh`，使用独立 PostgreSQL 16 临时容器（默认 loopback 15437，可用 `OVERNIGHT_PG_PORT` 指定空闲端口）。已通过5项检查：版本、数据库约束导致的真实保存失败回滚、跨企业拒绝、正常替换与嵌套字段防伪造、并发替换完整性。容器自动清理；不连接项目既有数据库，不发送消息，也不覆盖 HTTP/网关认证验证。
- **限制**：步骤快照、多副本执行锁与持久化任务调度仍未实现。批量替换事务不代表模板创建/删除等所有写入口都已完成事务审计；网关转发身份的网络信任边界及完整真实 HTTP/数据库链路不由上述数据库或单元测试证明。

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
DB_PORT=5432
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
- PostgreSQL: 数据存储
- Redis: 其它组件缓存基础设施
- PostgreSQL SOP租约worker: 当前持久调度；Bull已配置但未用于SOP

## 注意事项

1. **SOP执行**
   - SOP延时使用PostgreSQL截止时间与租约worker，Bull配置不承担SOP调度
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


### SOP动作保存与执行校验（2026-10-26）

新增共享配置校验用于inline创建、批量步骤替换和执行器；直接调用模板服务也在写入前校验，替换无效配置不能先删除原步骤。动作只支持既有1–5，步骤名非空且最多100个Unicode码点，stepOrder在PostgreSQL INT32正整数范围。校验不把未知metadata覆盖掉，JSON字符串动作、plain-text消息及文档别名tags/staffId/userId/text/assetUrl/link继续按对应动作解释。

员工、标签、执行目标编号只接受正安全JSON整数或规范十进制字符串，拒绝boolean/数组作单个ID、指数/十六进制/空白/前导零/小数/溢出。提醒与标签数组须1–100项并去重；标签ID另受其INT32列限制。执行器把canonical员工串明确转成数字后才调用严格通知/客户接口，不能用宽松Number(value)把坏配置修成员工1。

延迟为非负整数，实际支持单位仅minute/hour/day，折算最多365天；未实现的second明确拒绝。30day仍有效，超过Node单次timer上限的合法延迟仍分段等待；执行器先验证再判断是否等待，负值不能跳过。旧DB非法配置记失败且currentStep不推进、不执行后续动作。

模板类型与触发目标类型须一致，恢复时也检查当前模板与原执行目标一致。群SOP保存不能包含客户打标签/分配动作；执行器还拒绝legacy混合customerId/groupId与targetType不一致的行。正常group触发原来就只写groupId并会拒绝客户专属动作，不把这项额外保护描述成已发生正常同号客户误操作。

成功必须有业务确认：消息/素材仍要求success1/failed0；站内提醒要求服务success=true及count等于去重目标数；客户分配按实际CustomerController code200并核对返回客户与followUserId；打标签按code200确认，下游全批标签归属/存在拒绝会让SOP失败。这里stepType5是实际持久化的站内通知，messageType5才是模拟消息；二者不能混称Mock。

步骤1/3可明确提供optional action.templateId作为消息模板元数据引用，仅JSON正整数INT32（不接受字符串/布尔/null）；条件转发，省略时不新增属性。下游验证本企业存在，既有本企disabled/异channel引用仍可作为metadata，既不更换messageType也不替换显式正文/extra。旧未知metadata继续保存。

模板/步骤及模板引用列为INT32，模板路径/相关ID DTO拒绝超过2147483647；对应execute/steps-batch/executions/control验证使用400。inline模板配置验证仍沿用422。execution自身实体与DDL为BIGSERIAL，客户/员工/群也保持正safe整数范围，未被误缩为INT32。旧路径单元测试把MAX_SAFE当合法模板ID的假设已修正为INT32_MAX，增加真实越界22003→400回归。

动作校验首轮本地operation **10文件255单元测试通过**，tsc --noEmit通过；隔离真实auth/customer/message/operation/gateway + PG16/Redis **12场景通过，6.5s**，精确SQL10执行为6失败零进度+4成功、1条合法去重站内通知、0客户标签关系、2条带自企引用的Mock5日志。清理通过。详见[动作配置验证报告](../../tests/2026-10-26-sop-action-validation.md)。这些事实不代表第三方送达或生产部署。

### 模板inline创建原子性与存储字段边界（2026-10-26）

createTemplate现在由同一个callback manager事务创建模板与全部步骤，两类repository均从该manager取得；有效步骤发生数据库异常会整体回滚，不留下无步骤父模板。模板/步骤仍逐字段allowlist，缺省steps和description语义保持。templateName最多100Unicode码点；description为TEXT，不附加任意短长度上限。optional actionType为SMALLINT整数[-32768,32767]或null，非法类型/溢出在写入前拒绝；不把合法actionType擅自映射成stepType。

实际源方法+TypeORM/PG16受控CHECK失败23514：旧代码父模板残留1/子步骤0，新代码父0/子0。独立PG6检查及原批量替换5项均通过；旧批量故障注入改为合法名称受CHECK拒绝，避免名称新前置校验使数据库回滚测试失去意义。operation最新11文件276单元测试与tsc通过。

补丁后fresh `mw build --clean` 的实际SOP套件由12扩为13场景，7.1s全通过：新增真实HTTP inline创建合法标签模板→执行成功，负向外企/群步骤先确认无标签，最终唯一关系为本企标签94111。11执行=6失败零进度+5成功，站内通知仍1条，Mock5日志仍2条，正文/extra/ref保持，清理通过。完整历史与新证据见[动作配置验证报告](../../tests/2026-10-26-sop-action-validation.md)。
