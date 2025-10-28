# Finance Service - 财务管理服务

## 概述

财务管理服务负责订单管理、支付处理、发票管理和财务统计等功能。

## 核心功能

### 1. 订单管理
- 创建订单
- 查询订单
- 取消订单
- 订单状态管理
- 订单超时处理

### 2. 支付管理
- 支付创建
- 支付回调处理
- 支付状态查询
- 退款处理
- 多支付方式支持（微信、支付宝）

### 3. 发票管理
- 发票申请
- 发票开具
- 发票查询
- 普通发票/增值税专用发票

### 4. 财务统计
- 订单统计
- 收入统计
- 退款统计

## 技术栈

- **框架**: Midway.js
- **ORM**: TypeORM
- **数据库**: MySQL
- **缓存**: Redis
- **支付**: 微信支付、支付宝

## API 接口

### 订单管理

#### 创建订单
```http
POST /api/order
Content-Type: application/json

{
  "productName": "标准版套餐",
  "productType": 1,
  "amount": 9999.00,
  "discountAmount": 1000.00,
  "detail": {
    "duration": 12,
    "users": 100
  },
  "remark": "年付优惠"
}
```

响应示例：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "orderNo": "ORD17301234567890001",
    "productName": "标准版套餐",
    "amount": 9999.00,
    "discountAmount": 1000.00,
    "actualAmount": 8999.00,
    "status": 1,
    "expireTime": "2025-10-28T13:00:00.000Z",
    "createTime": "2025-10-28T12:30:00.000Z"
  },
  "message": "订单创建成功"
}
```

#### 查询订单列表
```http
GET /api/order/list?status=1&page=1&pageSize=20
```

#### 获取订单详情
```http
GET /api/order/:id
```

#### 取消订单
```http
PUT /api/order/:id/cancel
Content-Type: application/json

{
  "reason": "暂不需要"
}
```

### 支付管理

#### 创建支付
```http
POST /api/payment
Content-Type: application/json

{
  "orderId": 1,
  "paymentMethod": "wechat"
}
```

#### 支付回调（第三方调用）
```http
POST /api/payment/callback
Content-Type: application/json

{
  "orderNo": "ORD17301234567890001",
  "transactionId": "WX123456789",
  "detail": {}
}
```

#### 申请退款
```http
POST /api/payment/refund
Content-Type: application/json

{
  "orderId": 1,
  "refundAmount": 8999.00,
  "reason": "服务不满意"
}
```

#### 查询支付记录
```http
GET /api/payment/order/:orderId
```

### 发票管理

#### 申请发票
```http
POST /api/invoice
Content-Type: application/json

{
  "orderId": 1,
  "invoiceType": 1,
  "buyerName": "XX科技有限公司",
  "buyerTaxNo": "91110000000000000X",
  "buyerAddress": "北京市朝阳区XX路XX号",
  "buyerPhone": "010-12345678",
  "buyerBank": "中国工商银行XX支行",
  "buyerAccount": "1234567890123456789",
  "remark": "软件服务费"
}
```

#### 开具发票（管理员）
```http
PUT /api/invoice/:id/issue
```

#### 查询发票列表
```http
GET /api/invoice/list?orderId=1&status=1
```

## 订单状态

- `1` - 待支付
- `2` - 已支付
- `3` - 已取消
- `4` - 已退款

## 支付状态

- `1` - 待支付
- `2` - 支付成功
- `3` - 支付失败
- `4` - 已退款

## 发票状态

- `1` - 待开票
- `2` - 已开票
- `3` - 已作废

## 环境配置

```env
PORT=7009
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=open_scrm

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 微信支付配置
WECHAT_MCH_ID=xxx
WECHAT_API_KEY=xxx
WECHAT_NOTIFY_URL=https://your-domain.com/api/payment/callback

# 支付宝配置
ALIPAY_APP_ID=xxx
ALIPAY_PRIVATE_KEY=xxx
ALIPAY_PUBLIC_KEY=xxx
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payment/callback

# 发票配置
TAX_RATE=0.06
ISSUER_NAME=XX科技有限公司
ISSUER_TAX_NO=91110000000000000X
ISSUER_ADDRESS=北京市朝阳区XX路XX号
ISSUER_PHONE=010-12345678
ISSUER_BANK=中国工商银行XX支行
ISSUER_ACCOUNT=1234567890123456789

# 订单配置
ORDER_TIMEOUT=30
AUTO_CONFIRM_DAYS=7
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

## 业务流程

### 订单流程
1. 用户创建订单
2. 系统生成订单号
3. 用户选择支付方式
4. 完成支付
5. 支付成功后订单状态变更
6. 可申请开具发票

### 退款流程
1. 用户申请退款
2. 系统处理退款请求
3. 调用支付接口退款
4. 更新订单和支付状态

### 发票流程
1. 用户申请发票
2. 填写发票抬头信息
3. 管理员审核
4. 开具发票
5. 发送给用户

## 依赖服务

- MySQL: 数据存储
- Redis: 缓存
- 微信支付/支付宝: 支付处理

## 版本历史

### v1.0.0 (2025-10-28)
- 初始版本
- 订单管理
- 支付管理
- 发票管理

