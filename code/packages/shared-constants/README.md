# 共享常量包 (Shared Constants)

提供前后端通用的常量定义。

## 模块说明

### 状态码 (status-code.ts)
- `StatusCode` - HTTP状态码
- `ErrorCode` - 业务错误码

### 配置常量 (config.ts)
- `PAGINATION` - 分页配置
- `CACHE` - 缓存配置
- `JWT` - JWT配置
- `UPLOAD` - 文件上传配置
- `RATE_LIMIT` - 限流配置
- `MQ` - 消息队列配置

### 正则表达式 (regex.ts)
- `REGEX` - 常用正则表达式

### 平台常量 (platform.ts)
- `PLATFORM` - 平台类型
- `WEWORK` - 企业微信配置
- `DOUYIN` - 抖音配置
- `XIAOHONGSHU` - 小红书配置

## 使用方式

```typescript
import { StatusCode, ErrorCode, PAGINATION, REGEX } from '@scrm/shared-constants';

// 使用状态码
if (response.code === StatusCode.SUCCESS) {
  // ...
}

// 使用分页配置
const page = query.page || PAGINATION.DEFAULT_PAGE;

// 使用正则验证
const isValid = REGEX.MOBILE.test(mobile);
```

