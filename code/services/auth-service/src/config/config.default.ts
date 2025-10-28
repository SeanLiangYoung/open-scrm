import { MidwayConfig } from '@midwayjs/core';

export default {
  // Koa配置
  koa: {
    port: 7001
  },

  // TypeORM配置
  typeorm: {
    dataSource: {
      default: {
        type: 'mysql',
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306'),
        username: process.env.DB_USERNAME || 'root',
        password: process.env.DB_PASSWORD || 'root123',
        database: process.env.DB_DATABASE || 'scrm_dev',
        synchronize: false, // 生产环境必须为false
        logging: process.env.NODE_ENV === 'development',
        entities: ['**/entity/*{.ts,.js}'],
        timezone: '+08:00',
        charset: 'utf8mb4'
      }
    }
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
      port: parseInt(process.env.REDIS_PASSWORD || '6379'),
      password: process.env.REDIS_PASSWORD || '',
      db: 0
    }
  },

  // CORS配置
  cors: {
    origin: '*',
    credentials: true
  },

  // BCrypt配置
  bcrypt: {
    saltRounds: 12
  }
} as MidwayConfig;

