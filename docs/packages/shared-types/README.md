# 共享类型定义包 (Shared Types)

> 所有前端应用和后端服务共享的TypeScript类型定义

---

## 📋 项目概览

共享类型定义包提供了整个SCRM系统中使用的通用类型定义、接口定义、枚举类型等，确保前后端类型一致性，提升开发效率和代码质量。

### 核心内容

- 📝 **API类型**: 请求/响应类型、分页类型
- 👥 **业务模型**: 客户、用户、订单等业务实体类型
- 🏷️ **枚举类型**: 状态枚举、角色枚举、权限枚举
- 🔧 **工具类型**: 通用工具类型、辅助类型

---

## 📁 项目结构

```
shared-types/
├── src/
│   ├── api/                    # API类型
│   │   ├── request.ts          # 请求类型
│   │   ├── response.ts         # 响应类型
│   │   └── pagination.ts       # 分页类型
│   │
│   ├── models/                 # 业务模型
│   │   ├── user.ts             # 用户类型
│   │   ├── customer.ts         # 客户类型
│   │   ├── sop.ts              # SOP类型
│   │   ├── tag.ts              # 标签类型
│   │   └── order.ts            # 订单类型
│   │
│   ├── enums/                  # 枚举类型
│   │   ├── user-status.enum.ts
│   │   ├── customer-status.enum.ts
│   │   ├── role.enum.ts
│   │   └── permission.enum.ts
│   │
│   ├── utils/                  # 工具类型
│   │   └── helpers.ts
│   │
│   └── index.ts                # 统一导出
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📝 类型定义示例

### API类型

```typescript
// src/api/response.ts

/**
 * 统一响应格式
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * 分页响应
 */
export interface PaginationResponse<T> {
  list: T[];
  total: number;
  page: number;
  size: number;
}

/**
 * 分页请求
 */
export interface PaginationRequest {
  page?: number;
  size?: number;
  keyword?: string;
}
```

### 用户类型

```typescript
// src/models/user.ts

/**
 * 用户信息
 */
export interface User {
  id: number;
  corpId: number;
  username: string;
  realName?: string;
  mobile?: string;
  email?: string;
  avatar?: string;
  status: UserStatus;
  isAdmin: boolean;
  roles?: Role[];
  createTime: string;
  updateTime: string;
}

/**
 * 用户登录信息
 */
export interface LoginInfo {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  username: string;
  password: string;
}
```

### 客户类型

```typescript
// src/models/customer.ts

/**
 * 客户信息
 */
export interface Customer {
  id: number;
  corpId: number;
  externalUserid: string;
  name?: string;
  avatar?: string;
  type: CustomerType;
  gender?: Gender;
  unionid?: string;
  province?: string;
  city?: string;
  followUserId?: number;
  addTime?: string;
  channel?: string;
  status: CustomerStatus;
  tags?: Tag[];
  createTime: string;
  updateTime: string;
}

/**
 * 客户查询参数
 */
export interface CustomerQuery extends PaginationRequest {
  channel?: string;
  status?: CustomerStatus;
  followUserId?: number;
  tagIds?: number[];
}

/**
 * 创建客户
 */
export interface CreateCustomerDto {
  corpId: number;
  externalUserid: string;
  name?: string;
  avatar?: string;
  type?: CustomerType;
  gender?: Gender;
  province?: string;
  city?: string;
  followUserId?: number;
  channel?: string;
}
```

### SOP类型

```typescript
// src/models/sop.ts

/**
 * SOP模板
 */
export interface SopTemplate {
  id: number;
  corpId: number;
  templateName: string;
  templateType: SopTemplateType;
  triggerType: SopTriggerType;
  triggerCondition: any;
  status: SopStatus;
  steps: SopStep[];
  createTime: string;
  updateTime: string;
}

/**
 * SOP步骤
 */
export interface SopStep {
  id: number;
  templateId: number;
  stepOrder: number;
  stepType: SopStepType;
  delayTime: number;
  delayUnit: DelayUnit;
  actionType: SopActionType;
  actionContent: any;
}

/**
 * SOP执行记录
 */
export interface SopExecution {
  id: number;
  corpId: number;
  templateId: number;
  customerId?: number;
  groupId?: number;
  currentStep: number;
  status: SopExecutionStatus;
  startTime: string;
  completeTime?: string;
}
```

### 枚举类型

```typescript
// src/enums/user-status.enum.ts
export enum UserStatus {
  DISABLED = 0,
  ACTIVE = 1
}

// src/enums/customer-status.enum.ts
export enum CustomerStatus {
  DELETED = 0,
  ACTIVE = 1,
  LOST = 2
}

// src/enums/customer-type.enum.ts
export enum CustomerType {
  WECHAT = 1,
  WEWORK = 2
}

// src/enums/gender.enum.ts
export enum Gender {
  UNKNOWN = 0,
  MALE = 1,
  FEMALE = 2
}

// src/enums/sop.enum.ts
export enum SopTemplateType {
  CUSTOMER = 1,
  GROUP = 2
}

export enum SopTriggerType {
  ADD_FRIEND = 1,
  TAG = 2,
  JOIN_GROUP = 3
}

export enum SopStepType {
  SEND_MESSAGE = 1,
  ADD_TAG = 2,
  PUSH_MATERIAL = 3
}

export enum SopStatus {
  DISABLED = 0,
  ACTIVE = 1
}

export enum SopExecutionStatus {
  RUNNING = 0,
  COMPLETED = 1,
  PAUSED = 2
}

export enum DelayUnit {
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day'
}

// src/enums/role.enum.ts
export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPERATOR = 'operator',
  SALES = 'sales',
  VIEWER = 'viewer'
}
```

### 标签类型

```typescript
// src/models/tag.ts

/**
 * 标签
 */
export interface Tag {
  id: number;
  corpId: number;
  tagName: string;
  tagType: TagType;
  parentId: number;
  sort: number;
  isAuto: boolean;
  createTime: string;
}

export enum TagType {
  SOURCE = 1,      // 来源标签
  BEHAVIOR = 2,    // 行为标签
  INTEREST = 3,    // 兴趣标签
  VALUE = 4        // 价值标签
}
```

---

## 🚀 使用方式

### 安装

在其他项目中引用：

```json
// package.json
{
  "dependencies": {
    "@scrm/shared-types": "workspace:*"
  }
}
```

### 前端使用

```typescript
// Vue组件中使用
import type { Customer, CustomerQuery } from '@scrm/shared-types'

const customerList = ref<Customer[]>([])

const fetchCustomers = async (query: CustomerQuery) => {
  const res = await api.getCustomerList(query)
  customerList.value = res.data.list
}
```

### 后端使用

```typescript
// Midway Service中使用
import type { CreateCustomerDto, Customer } from '@scrm/shared-types'

@Provide()
export class CustomerService {
  async createCustomer(dto: CreateCustomerDto): Promise<Customer> {
    // ...
  }
}
```

---

## 📦 构建

```bash
# 构建
pnpm build

# 类型检查
pnpm type-check
```

---

## 🔄 版本管理

使用语义化版本：

- **MAJOR**: 不兼容的API变更
- **MINOR**: 新增功能且向后兼容
- **PATCH**: 修复Bug且向后兼容

---

## 📞 联系方式

- 负责人: [待填写]
- 维护: 所有开发人员共同维护

---

**最后更新**: 2025-10-28

