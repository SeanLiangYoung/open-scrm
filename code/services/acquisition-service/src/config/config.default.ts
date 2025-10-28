import { MidwayConfig } from '@midwayjs/core';

export default {
  // 应用密钥配置（用于cookie签名等）
  keys: process.env.APP_KEYS || 'acquisition_service_secret_key_please_change_in_production',

  // Koa配置
  koa: {
    port: 7003,
  },

  // TypeORM配置
  typeorm: {
    dataSource: {
      default: {
        type: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        database: process.env.DB_DATABASE || 'open_scrm',
        synchronize: false,
        logging: process.env.NODE_ENV === 'local',
        entities: ['**/entity/*.entity{.ts,.js}'],
        timezone: '+08:00',
        charset: 'utf8mb4',
      },
    },
  },

  // Redis配置
  redis: {
    client: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || '',
      db: parseInt(process.env.REDIS_DB || '0'),
    },
  },

  // OSS配置
  oss: {
    client: {
      accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
      bucket: process.env.OSS_BUCKET || '',
      endpoint: process.env.OSS_ENDPOINT || '',
      timeout: 60000,
    },
  },

  // 获客服务配置
  acquisition: {
    // 平台配置
    platforms: {
      douyin: {
        enabled: true,
        apiBaseUrl: 'https://open.douyin.com',
      },
      xiaohongshu: {
        enabled: true,
        apiBaseUrl: 'https://open.xiaohongshu.com',
      },
    },
    
    // 渠道活码配置
    channelCode: {
      qrcodeSize: 400,
      cacheExpire: 86400, // 24小时
    },
    
    // 依赖服务地址
    services: {
      customer: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:7002',
      integration: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:7007',
    },
  },
} as MidwayConfig;

