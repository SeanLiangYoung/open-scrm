import { MidwayConfig } from '@midwayjs/core';

export default {
  // 应用密钥配置（用于cookie签名等）
  keys: process.env.APP_KEYS || 'operation_service_secret_key_please_change_in_production',

  // Koa配置
  koa: {
    port: 7004,
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

  // Bull队列配置
  bull: {
    defaultQueueOptions: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || '',
        db: parseInt(process.env.REDIS_DB || '1'),
      },
    },
  },

  // 运营服务配置
  operation: {
    // SOP执行配置
    sop: {
      maxConcurrent: 10, // 最大并发执行数
      retryTimes: 3, // 重试次数
      retryDelay: 60000, // 重试延迟(ms)
    },
    
    // 群发任务配置
    massTask: {
      batchSize: 100, // 每批次数量
      batchInterval: 1000, // 批次间隔(ms)
      maxRetries: 3,
    },
    
    // 依赖服务地址
    services: {
      customer: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:7002',
      message: process.env.MESSAGE_SERVICE_URL || 'http://localhost:7008',
      integration: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:7007',
    },
  },
} as MidwayConfig;

