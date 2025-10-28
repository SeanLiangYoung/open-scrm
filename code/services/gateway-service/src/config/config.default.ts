import { MidwayConfig } from '@midwayjs/core';

export default {
  // 应用密钥配置（用于cookie签名等）
  keys: process.env.APP_KEYS || 'gateway_service_secret_key_please_change_in_production',

  // Koa配置
  koa: {
    port: 7001,
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'scrm-jwt-secret-key-change-in-production',
    expiresIn: '2h'
  },

  // Redis配置
  redis: {
    client: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || '',
      db: 0
    }
  },

  // CORS配置
  cors: {
    origin: '*',
    credentials: true
  },

  // 路由配置
  gateway: {
    routes: [
      {
        path: '/api/v1/auth/*',
        target: process.env.AUTH_SERVICE_URL || 'http://localhost:7001'
      },
      {
        path: '/api/v1/customers/*',
        target: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:7002'
      },
      {
        path: '/api/v1/acquisition/*',
        target: process.env.ACQUISITION_SERVICE_URL || 'http://localhost:7003'
      },
      {
        path: '/api/v1/operation/*',
        target: process.env.OPERATION_SERVICE_URL || 'http://localhost:7004'
      },
      {
        path: '/api/v1/assets/*',
        target: process.env.ASSET_SERVICE_URL || 'http://localhost:7005'
      },
      {
        path: '/api/v1/analytics/*',
        target: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:7006'
      },
      {
        path: '/api/v1/integration/*',
        target: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:7007'
      },
      {
        path: '/api/v1/messages/*',
        target: process.env.MESSAGE_SERVICE_URL || 'http://localhost:7008'
      },
      {
        path: '/api/v1/finance/*',
        target: process.env.FINANCE_SERVICE_URL || 'http://localhost:7009'
      }
    ]
  },

  // 限流配置
  rateLimit: {
    max: 100, // 最大请求数
    duration: 60000 // 时间窗口(毫秒)
  }
} as MidwayConfig;

