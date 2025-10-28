import { MidwayConfig } from '@midwayjs/core';
import { tmpdir } from 'os';
import { join } from 'path';

export default {
  // 应用密钥配置（用于cookie签名等）
  keys: process.env.APP_KEYS || 'asset_service_secret_key_please_change_in_production',

  // Koa配置
  koa: {
    port: 7005,
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

  // 文件上传配置
  upload: {
    mode: 'file',
    fileSize: '100mb',
    tmpdir: join(tmpdir(), 'midway-upload-temp'),
    cleanTimeout: 5 * 60 * 1000,
  },

  // 素材服务配置
  asset: {
    // 支持的文件类型
    allowedTypes: {
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/avi', 'video/mov'],
      file: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    },
    
    // 文件大小限制（字节）
    maxSize: {
      image: 10 * 1024 * 1024, // 10MB
      video: 100 * 1024 * 1024, // 100MB
      file: 50 * 1024 * 1024, // 50MB
    },
    
    // OSS路径前缀
    ossPrefix: process.env.OSS_PREFIX || 'scrm-assets',
    
    // CDN域名
    cdnDomain: process.env.CDN_DOMAIN || '',
  },
} as MidwayConfig;

