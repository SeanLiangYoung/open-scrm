import { MidwayConfig } from '@midwayjs/core';

export default {
  // 应用密钥配置（用于cookie签名等）
  keys: process.env.APP_KEYS || 'finance_service_secret_key_please_change_in_production',

  // Koa配置
  koa: {
    port: 7009,
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

  // 财务服务配置
  finance: {
    // 支付配置
    payment: {
      // 微信支付
      wechat: {
        mchId: process.env.WECHAT_MCH_ID || '',
        apiKey: process.env.WECHAT_API_KEY || '',
        notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
      },
      // 支付宝
      alipay: {
        appId: process.env.ALIPAY_APP_ID || '',
        privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
        publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
        notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      },
    },
    
    // 发票配置
    invoice: {
      // 税率
      taxRate: parseFloat(process.env.TAX_RATE || '0.06'),
      // 开票方信息
      issuer: {
        name: process.env.ISSUER_NAME || '',
        taxNo: process.env.ISSUER_TAX_NO || '',
        address: process.env.ISSUER_ADDRESS || '',
        phone: process.env.ISSUER_PHONE || '',
        bank: process.env.ISSUER_BANK || '',
        account: process.env.ISSUER_ACCOUNT || '',
      },
    },
    
    // 订单配置
    order: {
      // 订单超时时间（分钟）
      timeout: parseInt(process.env.ORDER_TIMEOUT || '30'),
      // 自动确认收货时间（天）
      autoConfirmDays: parseInt(process.env.AUTO_CONFIRM_DAYS || '7'),
    },
  },
} as MidwayConfig;

