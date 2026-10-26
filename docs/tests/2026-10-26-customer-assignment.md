# 客户员工分配与表单契约验证

2026-10-26本地隔离验证，范围为客户创建/更新的显式跟进员工归属、可选分配省略、手机号/备注清空与运营表单请求形状。未连接项目既有数据库，未发送外部消息。

## 实现契约

服务保存客户前，对显式 `followUserId` 检查安全正整数，并使用带参数的共享PostgreSQL `"user"` 表查询验证同企业、启用员工。外企/停用/不存在员工返回400。省略时不自动分配，也不改变已有分配。

Update DTO仅新增 `mobile` / `remark` 的null允许值，用于显式清空数据库可空列；省略不修改。客户表单移除不受DTO/实体支持的邮箱字段和旧source提交，移除硬编码身份/员工，创建使用channel；来源在编辑时只读。姓名为表单必填。无员工选择器，未宣称自动分配当前员工。

## 测试驱动证据

- 员工校验新增回归首先8失败/2通过：缺少权威查询，且外企、停用、不存在员工创建/更新被接受。
- 表单最初2项浏览器回归失败：正文实际包含corpId1、followUserId1、email/source及空字符串；编辑界面提供未被后端支持的字段。
- null清空DTO回归首先1失败/2通过，确认原DTO不接受null；清空及姓名必填浏览器回归先2项失败，再修复。
- 最终customer-service **4文件75项单元测试通过**（跟进54、metadata1、员工分配17、更新DTO3），类型检查及构建通过。
- 独立客户表单配置 **4项Playwright通过**：创建最小字段/省略身份员工、编辑只读来源/白名单、显式null清空、不发空姓名创建。此套拦截API，只证明页面和请求契约，没有真实服务/数据库调用。

可复现命令：

```bash
cd code/services/customer-service
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/mw build
```

```bash
cd code/e2e
./node_modules/.bin/playwright test --config customer-form-contracts.config.ts
```

## 实际PostgreSQL16验证

仓库根运行：

```bash
code/scripts/test/overnight-customer-assignment-postgres.sh
```

[Shell入口](../../code/scripts/test/overnight-customer-assignment-postgres.sh) / [实际CustomerService验证](../../code/scripts/test/overnight-customer-assignment-postgres.cjs)。临时容器使用本地 `postgres:16-alpine`，实际为**16.13**；默认loopback15441可由 `OVERNIGHT_PG_PORT` 指定空闲端口。脚本执行完整初始化，使用专用数据库 `overnight_assignment`，不修改既有库。

**13项检查通过**：同企业启用员工创建及更新、外企/停用/不存在员工分别在创建和更新拒绝、不提供分配时创建为null、不提供分配时保留已有员工（包括后来已停用者）、显式null清空手机号/备注的实际保存读取、真实DTO schema接受修复后的表单正文并拒绝旧正文、拒绝后最终企业771客户精确2条。数据库没有使用synchronize；用户表查询和客户保存均通过实际TypeORM连接执行。

脚本退出0，自动删除仅本次创建的容器；完成后专用 `open-scrm.verification=overnight-customer-assignment` 标签查询无残留。没有用户数据库、真实发送、提交或推送。

## 边界

本次员工校验是保存前的状态检查，不提供员工状态跨请求永久不变的事务保证。手机号/备注之外的可空字段没有扩展契约。其他客户/标签接口、导入路径、员工分配产品选择器与真实浏览器经过HTTP的整链验证不在此报告范围；后者由单独报告提供证据。当前共库部署使客户服务可读取权威user表，独立数据库部署需要另行设计查询边界。
