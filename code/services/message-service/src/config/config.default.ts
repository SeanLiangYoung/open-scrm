import { MidwayConfig } from '@midwayjs/core';

export default {
  // Koa配置
  koa: {
    port: 7008,
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

  // 消息服务配置
  message: {
    // 批量发送配置
    batchSize: 100, // 每批次发送数量
    batchInterval: 1000, // 批次间隔(ms)
    
    // 重试配置
    maxRetries: 3,
    retryDelay: 5000,
    
    // 企业微信消息配置
    wework: {
      enabled: true,
      maxTextLength: 2048,
    },
    
    // 站内通知配置
    notification: {
      enabled: true,
      defaultExpireDays: 30,
    },
  },
} as MidwayConfig;

