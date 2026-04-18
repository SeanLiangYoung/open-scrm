import { MidwayConfig } from '@midwayjs/core';

export default {
  // 应用密钥配置（用于cookie签名等）
  keys: process.env.APP_KEYS || 'analytics_service_secret_key_please_change_in_production',

  // Koa配置
  koa: {
    port: 7006,
  },

  // TypeORM配置
  typeorm: {
    dataSource: {
      default: {
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'root123',
        database: process.env.DB_DATABASE || 'scrm_dev',
        synchronize: false,
        logging: process.env.NODE_ENV === 'local',
        entities: ['**/entity/*.entity{.ts,.js}'],
        timezone: '+08:00',
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

  // 数据分析配置
  analytics: {
    // 统计数据聚合间隔（分钟）
    aggregateInterval: parseInt(process.env.AGGREGATE_INTERVAL || '60'),
    
    // 实时数据缓存时间（秒）
    realtimeCacheTTL: parseInt(process.env.REALTIME_CACHE_TTL || '300'),
    
    // 历史数据保留天数
    historyRetentionDays: parseInt(process.env.HISTORY_RETENTION_DAYS || '365'),
    
    // 依赖服务地址
    services: {
      customer: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:7002',
      message: process.env.MESSAGE_SERVICE_URL || 'http://localhost:7008',
      operation: process.env.OPERATION_SERVICE_URL || 'http://localhost:7004',
      acquisition: process.env.ACQUISITION_SERVICE_URL || 'http://localhost:7003',
    },
  },
} as MidwayConfig;

