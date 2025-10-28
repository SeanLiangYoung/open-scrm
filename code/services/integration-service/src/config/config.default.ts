import { MidwayConfig } from '@midwayjs/core';

export default {
  // 应用密钥配置（用于cookie签名等）
  keys: process.env.APP_KEYS || 'integration_service_secret_key_please_change_in_production',

  // Koa配置
  koa: {
    port: 7007,
  },
  
  // TypeORM配置
  typeorm: {
    dataSource: {
      default: {
        type: 'mysql',
        host: process.env.MYSQL_HOST || 'localhost',
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        username: process.env.MYSQL_USER || 'scrm',
        password: process.env.MYSQL_PASSWORD || 'scrm_password',
        database: process.env.MYSQL_DATABASE || 'scrm_integration',
        synchronize: process.env.NODE_ENV === 'local',
        logging: process.env.NODE_ENV === 'local',
        entities: ['**/entity/*.entity{.ts,.js}'],
        charset: 'utf8mb4',
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
      db: 2, // integration-service 使用 db2
    },
  },

  // Axios配置
  axios: {
    default: {
      timeout: 30000,
    },
  },

  // 企业微信配置
  wework: {
    apiBaseUrl: 'https://qyapi.weixin.qq.com',
    tokenCacheTTL: 7200, // Token缓存时间（秒）
  },

  // 日志配置
  midwayLogger: {
    default: {
      level: 'info',
      consoleLevel: 'info',
    },
  },

  // CORS配置
  cors: {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS',
  },
} as MidwayConfig;

