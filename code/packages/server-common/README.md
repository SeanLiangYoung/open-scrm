# 后端公共模块 (Server Common)

> 后端微服务通用的中间件、拦截器、过滤器、装饰器和工具类

---

## 📋 项目概览

`server-common`包提供了所有后端微服务共享的基础功能，确保代码复用和一致性。

### 核心内容

- 🔧 **中间件**: 日志记录、请求追踪
- 🎯 **拦截器**: 统一响应格式、数据转换
- 🛡️ **过滤器**: 全局异常处理、HTTP异常处理
- 🎨 **装饰器**: 权限控制、API文档标记
- 🔨 **工具类**: 响应构建、分页计算

---

## 📁 项目结构

```
server-common/
├── src/
│   ├── middleware/             # 中间件
│   │   └── logger.middleware.ts
│   │
│   ├── interceptor/            # 拦截器
│   │   └── response.interceptor.ts
│   │
│   ├── filter/                 # 过滤器
│   │   ├── http-exception.filter.ts
│   │   └── global-exception.filter.ts
│   │
│   ├── decorator/              # 装饰器
│   │   ├── api-response.decorator.ts
│   │   └── require-role.decorator.ts
│   │
│   ├── util/                   # 工具类
│   │   ├── response.util.ts
│   │   └── pagination.util.ts
│   │
│   └── index.ts                # 统一导出
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 使用方式

### 安装

在微服务的package.json中引用：

```json
{
  "dependencies": {
    "@scrm/server-common": "workspace:*"
  }
}
```

### 1. 日志中间件

```typescript
// src/configuration.ts
import { LoggerMiddleware } from '@scrm/server-common';

@Configuration({
  imports: [koa]
})
export class MainConfiguration {
  @App()
  app: Application;

  async onReady() {
    this.app.useMiddleware([LoggerMiddleware]);
  }
}
```

### 2. 响应拦截器

```typescript
// 自动包装响应为统一格式
import { ResponseInterceptor } from '@scrm/server-common';

@Configuration({
  imports: [koa]
})
export class MainConfiguration {
  @App()
  app: Application;

  async onReady() {
    this.app.useMiddleware([ResponseInterceptor]);
  }
}
```

**响应前**:
```json
{ "id": 1, "name": "张三" }
```

**响应后**:
```json
{
  "code": 200,
  "message": "success",
  "data": { "id": 1, "name": "张三" },
  "timestamp": "2025-10-28T10:00:00.000Z",
  "duration": 15
}
```

### 3. 全局异常过滤器

```typescript
// src/configuration.ts
import { GlobalExceptionFilter } from '@scrm/server-common';

@Configuration({
  imports: [koa]
})
export class MainConfiguration {
  @App()
  app: Application;

  async onReady() {
    this.app.useFilter([GlobalExceptionFilter]);
  }
}
```

### 4. 角色权限装饰器

```typescript
// src/controller/user.controller.ts
import { Controller, Delete, Param } from '@midwayjs/core';
import { RequireRole } from '@scrm/server-common';

@Controller('/api/v1/users')
export class UserController {
  @Delete('/:id')
  @RequireRole(['admin', 'super_admin'])
  async deleteUser(@Param('id') id: number) {
    // 只有admin或super_admin角色可以访问
    return { success: true };
  }
}
```

### 5. 响应工具类

```typescript
// src/controller/customer.controller.ts
import { Controller, Get, Query } from '@midwayjs/core';
import { success, fail, paginate } from '@scrm/server-common';

@Controller('/api/v1/customers')
export class CustomerController {
  // 成功响应
  @Get('/:id')
  async getCustomer(@Param('id') id: number) {
    const customer = await this.customerService.findById(id);
    return success(customer);
  }

  // 失败响应
  @Get('/:id')
  async getCustomer(@Param('id') id: number) {
    if (!customer) {
      return fail(404, '客户不存在');
    }
    return success(customer);
  }

  // 分页响应
  @Get('/')
  async getCustomerList(@Query() query: any) {
    const { list, total } = await this.customerService.findAll(query);
    return paginate(list, total, query.page, query.size);
  }
}
```

### 6. 分页工具

```typescript
// src/service/customer.service.ts
import { calculatePagination } from '@scrm/server-common';

export class CustomerService {
  async findAll(query: any) {
    const { page, size, skip, take } = calculatePagination(query);

    const [list, total] = await this.customerRepo.findAndCount({
      skip,
      take
    });

    return { list, total, page, size };
  }
}
```

---

## 📦 构建

```bash
# 构建
pnpm build

# 开发模式（watch）
pnpm dev

# 类型检查
pnpm type-check

# 清理
pnpm clean
```

---

## 🔄 版本管理

使用语义化版本：
- **MAJOR**: 不兼容的API变更
- **MINOR**: 新增功能且向后兼容
- **PATCH**: 修复Bug且向后兼容

---

## 📝 最佳实践

### 1. 统一错误处理

所有微服务应使用`GlobalExceptionFilter`进行统一的错误处理：

```typescript
try {
  // 业务逻辑
} catch (error) {
  // 不需要手动处理，GlobalExceptionFilter会自动捕获
  throw error;
}
```

### 2. 统一响应格式

使用响应工具类构建一致的API响应：

```typescript
// ✅ 推荐
return success(data);
return fail(404, '资源不存在');
return paginate(list, total, page, size);

// ❌ 不推荐
return { code: 200, data };  // 格式不一致
```

### 3. 权限控制

使用装饰器进行声明式权限控制：

```typescript
// ✅ 推荐
@RequireRole(['admin'])
async sensitiveOperation() { }

// ❌ 不推荐
async sensitiveOperation() {
  if (!ctx.state.user.roles.includes('admin')) {
    throw new Error('权限不足');
  }
}
```

---

## 🔧 扩展指南

### 添加新的中间件

1. 在`src/middleware/`下创建新文件
2. 实现`IMiddleware`接口
3. 在`src/index.ts`中导出

```typescript
// src/middleware/custom.middleware.ts
import { Middleware, IMiddleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

@Middleware()
export class CustomMiddleware implements IMiddleware<Context, NextFunction> {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 中间件逻辑
      await next();
    };
  }

  static getName(): string {
    return 'custom';
  }
}
```

### 添加新的装饰器

```typescript
// src/decorator/custom.decorator.ts
import { createCustomMethodDecorator } from '@midwayjs/core';

export function CustomDecorator(param: any) {
  return createCustomMethodDecorator(async (ctx) => {
    // 装饰器逻辑
    return true;
  });
}
```

---

## 📞 联系方式

- 负责人: [待填写]
- 维护: 所有后端开发人员共同维护

---

**最后更新**: 2025-10-28

