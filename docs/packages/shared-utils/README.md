# 共享工具函数包 (Shared Utils)

提供前后端通用的工具函数。

## 功能模块

### 日期时间工具 (date.util.ts)
- `formatDate()` - 格式化日期时间
- `formatDateOnly()` - 格式化为日期
- `formatRelativeTime()` - 相对时间
- `getDateRange()` - 获取日期范围
- `daysBetween()` - 计算日期间隔

### 数据验证 (validate.util.ts)
- `isValidMobile()` - 验证手机号
- `isValidEmail()` - 验证邮箱
- `isValidUrl()` - 验证网址
- `getPasswordStrength()` - 密码强度检测

### 格式化工具 (format.util.ts)
- `formatMoney()` - 格式化金额
- `formatFileSize()` - 格式化文件大小
- `formatMobile()` - 脱敏手机号
- `formatPercentage()` - 格式化百分比
- `camelToSnake()` / `snakeToCamel()` - 命名转换

### 加密工具 (crypto.util.ts)
- `generateRandomString()` - 生成随机字符串
- `generateUUID()` - 生成UUID
- `base64Encode()` / `base64Decode()` - Base64编解码
- `generateSignature()` - 生成签名

## 使用方式

```typescript
import { formatDate, isValidMobile, formatMoney } from '@scrm/shared-utils';

// 格式化日期
const date = formatDate(new Date(), 'YYYY-MM-DD');

// 验证手机号
const isValid = isValidMobile('13800138000');

// 格式化金额
const money = formatMoney(1234567.89); // "1,234,567.89"
```

