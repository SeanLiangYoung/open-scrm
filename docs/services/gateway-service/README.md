# 网关服务 (Gateway Service)

> 基于Midway.js的API网关服务

---

## 📋 项目概览

API网关是整个微服务架构的入口，负责路由转发、认证鉴权、限流熔断、日志记录等功能。统一处理所有前端请求，并根据路由规则转发到相应的后端微服务。

### 核心功能

- 🔀 **路由转发**: 根据URL规则转发请求到目标服务
- 🔐 **认证鉴权**: JWT验证、权限检查、Token刷新
- 🚦 **限流熔断**: 防止服务过载、熔断保护
- 📝 **日志记录**: 统一日志格式、请求追踪
- 🔍 **监控追踪**: 请求监控、性能追踪
- 🛡️ **安全防护**: CORS、CSP、XSS防护
- 📊 **负载均衡**: 多实例负载均衡

---

## 🛠️ 技术栈

- **框架**: Midway.js 3.x
- **语言**: TypeScript 5.x
- **Web层**: @midwayjs/web (Koa)
- **JWT**: @midwayjs/jwt
- **日志**: @midwayjs/logger + winston
- **监控**: prom-client (Prometheus)
- **HTTP客户端**: @midwayjs/axios

---

## 📁 项目结构

```
gateway-service/
├── src/
│   ├── config/                 # 配置
│   │   ├── config.default.ts   # 默认配置
│   │   ├── config.local.ts     # 本地配置
│   │   └── config.prod.ts      # 生产配置
│   │
│   ├── middleware/             # 中间件
│   │   ├── AuthMiddleware.ts   # 认证中间件
│   │   ├── RateLimitMiddleware.ts  # 限流中间件
│   │   ├── LoggerMiddleware.ts # 日志中间件
│   │   └── CorsMiddleware.ts   # CORS中间件
│   │
│   ├── filter/                 # 过滤器
│   │   └── GlobalExceptionFilter.ts  # 全局异常过滤器
│   │
│   ├── interceptor/            # 拦截器
│   │   └── ResponseInterceptor.ts    # 响应拦截器
│   │
│   ├── guard/                  # 守卫
│   │   └── JwtGuard.ts         # JWT守卫
│   │
│   ├── service/                # 服务
│   │   ├── ProxyService.ts     # 代理服务
│   │   └── RouteService.ts     # 路由服务
│   │
│   ├── controller/             # 控制器
│   │   └── ProxyController.ts  # 代理控制器
│   │
│   ├── utils/                  # 工具
│   │   ├── JwtUtil.ts          # JWT工具
│   │   └── RouteUtil.ts        # 路由工具
│   │
│   ├── Configuration.ts        # 配置类
│   └── Bootstrap.ts            # 启动文件
│
├── test/                       # 测试
├── logs/                       # 日志
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发

```bash
pnpm dev
```

### 构建

```bash
pnpm build
```

### 启动

```bash
pnpm start
```

---

## 📝 核心功能实现

### 1. 路由配置

```typescript
// config/config.default.ts
export default {
  gateway: {
    routes: [
      {
        path: '/api/v1/auth/*',
        target: 'http://localhost:7001',  // auth-service
        rewrite: (path: string) => path
      },
      {
        path: '/api/v1/customers/*',
        target: 'http://localhost:7002',  // customer-service
        rewrite: (path: string) => path
      },
      {
        path: '/api/v1/acquisition/*',
        target: 'http://localhost:7003',  // acquisition-service
        rewrite: (path: string) => path
      }
    ]
  }
}
```

### 2. 认证中间件

```typescript
// middleware/AuthMiddleware.ts
import { Inject, Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/web';
import { JwtService } from '@midwayjs/jwt';

@Middleware()
export class AuthMiddleware {
  @Inject()
  jwtService: JwtService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 白名单路径
      const whitelist = ['/api/v1/auth/login', '/api/v1/auth/register'];
      if (whitelist.includes(ctx.path)) {
        return await next();
      }

      // 获取Token
      const token = ctx.get('authorization')?.replace('Bearer ', '');
      if (!token) {
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: '未授权,请先登录'
        };
        return;
      }

      try {
        // 验证Token
        const payload = await this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET
        });
        
        // 将用户信息挂载到ctx上
        ctx.state.user = payload;
        
        await next();
      } catch (error) {
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: 'Token无效或已过期'
        };
      }
    };
  }
}
```

### 3. 限流中间件

```typescript
// middleware/RateLimitMiddleware.ts
import { Inject, Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/web';
import { RedisService } from '@midwayjs/redis';

@Middleware()
export class RateLimitMiddleware {
  @Inject()
  redisService: RedisService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const key = `rate_limit:${ctx.ip}:${ctx.path}`;
      const limit = 100; // 每分钟100次
      const ttl = 60; // 60秒

      // 获取当前计数
      const current = await this.redisService.incr(key);
      
      if (current === 1) {
        // 第一次请求，设置过期时间
        await this.redisService.expire(key, ttl);
      }

      if (current > limit) {
        ctx.status = 429;
        ctx.body = {
          code: 429,
          message: '请求过于频繁,请稍后再试'
        };
        return;
      }

      // 设置响应头
      ctx.set('X-RateLimit-Limit', limit.toString());
      ctx.set('X-RateLimit-Remaining', (limit - current).toString());

      await next();
    };
  }
}
```

### 4. 代理服务

```typescript
// service/ProxyService.ts
import { Inject, Provide } from '@midwayjs/core';
import { HttpService } from '@midwayjs/axios';
import { Context } from '@midwayjs/web';

@Provide()
export class ProxyService {
  @Inject()
  httpService: HttpService;

  async proxy(ctx: Context, targetUrl: string) {
    try {
      const response = await this.httpService.request({
        method: ctx.method as any,
        url: targetUrl,
        data: ctx.request.body,
        params: ctx.query,
        headers: {
          ...ctx.headers,
          host: new URL(targetUrl).host
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`代理请求失败: ${error.message}`);
    }
  }
}
```

### 5. 全局异常过滤器

```typescript
// filter/GlobalExceptionFilter.ts
import { Catch, Logger } from '@midwayjs/core';
import { Context } from '@midwayjs/web';

@Catch()
export class GlobalExceptionFilter {
  @Logger()
  logger;

  async catch(err: Error, ctx: Context) {
    // 记录错误日志
    this.logger.error('Gateway Error:', err);

    // 返回统一错误格式
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: err.message || '服务器内部错误',
      timestamp: new Date().toISOString()
    };
  }
}
```

### 6. 响应拦截器

```typescript
// interceptor/ResponseInterceptor.ts
import { Interceptor, IWebMiddleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/web';

@Interceptor()
export class ResponseInterceptor implements IWebMiddleware {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const startTime = Date.now();

      await next();

      // 统一响应格式
      if (ctx.body && typeof ctx.body === 'object' && !ctx.body.code) {
        ctx.body = {
          code: 200,
          message: 'success',
          data: ctx.body,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        };
      }
    };
  }
}
```

---

## ⚙️ 配置说明

### 环境变量

```bash
# .env.local
NODE_ENV=development
PORT=7000

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE=2h

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 服务地址
AUTH_SERVICE_URL=http://localhost:7001
CUSTOMER_SERVICE_URL=http://localhost:7002
```

### 日志配置

```typescript
// config/config.default.ts
export default {
  midwayLogger: {
    default: {
      level: 'info',
      consoleLevel: 'info',
      dir: 'logs'
    }
  }
}
```

---

## 📊 监控指标

### Prometheus指标

```typescript
// 暴露metrics端点
import { Controller, Get } from '@midwayjs/core';
import { register } from 'prom-client';

@Controller('/metrics')
export class MetricsController {
  @Get('/')
  async getMetrics() {
    return await register.metrics();
  }
}
```

---

## 🔒 安全配置

### CORS配置

```typescript
// config/config.default.ts
export default {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
  }
}
```

### 安全头

```typescript
// middleware/SecurityMiddleware.ts
ctx.set('X-Content-Type-Options', 'nosniff');
ctx.set('X-Frame-Options', 'DENY');
ctx.set('X-XSS-Protection', '1; mode=block');
```

---

## 📞 联系方式

- 负责人: [待填写]
- 开发: [待填写]

---

**端口**: 7000  
**最后更新**: 2025-10-28

