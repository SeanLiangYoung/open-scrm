/**
 * 系统配置常量
 */

/**
 * 分页配置
 */
export const PAGINATION = {
  /** 默认页码 */
  DEFAULT_PAGE: 1,
  
  /** 默认每页数量 */
  DEFAULT_PAGE_SIZE: 20,
  
  /** 最大每页数量 */
  MAX_PAGE_SIZE: 100
} as const;

/**
 * 缓存配置
 */
export const CACHE = {
  /** 默认缓存时间(秒) */
  DEFAULT_TTL: 600,
  
  /** 短期缓存(5分钟) */
  SHORT_TTL: 300,
  
  /** 长期缓存(1小时) */
  LONG_TTL: 3600,
  
  /** Token缓存前缀 */
  TOKEN_PREFIX: 'token:',
  
  /** 用户信息缓存前缀 */
  USER_PREFIX: 'user:',
  
  /** 客户信息缓存前缀 */
  CUSTOMER_PREFIX: 'customer:'
} as const;

/**
 * JWT配置
 */
export const JWT = {
  /** Access Token过期时间(秒) */
  ACCESS_TOKEN_EXPIRES: 7200, // 2小时
  
  /** Refresh Token过期时间(秒) */
  REFRESH_TOKEN_EXPIRES: 604800 // 7天
} as const;

/**
 * 文件上传配置
 */
export const UPLOAD = {
  /** 最大文件大小(MB) */
  MAX_FILE_SIZE: 10,
  
  /** 图片最大大小(MB) */
  MAX_IMAGE_SIZE: 5,
  
  /** 视频最大大小(MB) */
  MAX_VIDEO_SIZE: 100,
  
  /** 允许的图片格式 */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  
  /** 允许的视频格式 */
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/mpeg', 'video/quicktime'],
  
  /** 允许的文档格式 */
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
} as const;

/**
 * 限流配置
 */
export const RATE_LIMIT = {
  /** 默认限流次数 */
  DEFAULT_LIMIT: 100,
  
  /** 默认限流时间窗口(秒) */
  DEFAULT_WINDOW: 60,
  
  /** 登录接口限流 */
  LOGIN_LIMIT: 5,
  
  /** 登录限流时间窗口(秒) */
  LOGIN_WINDOW: 300
} as const;

/**
 * 消息队列配置
 */
export const MQ = {
  /** 事件交换机 */
  EVENT_EXCHANGE: 'scrm.events',
  
  /** 任务交换机 */
  TASK_EXCHANGE: 'scrm.tasks',
  
  /** 死信交换机 */
  DLX_EXCHANGE: 'scrm.dlx',
  
  /** 客户事件队列 */
  CUSTOMER_QUEUE: 'customer.events',
  
  /** SOP任务队列 */
  SOP_QUEUE: 'sop.tasks',
  
  /** 消息发送队列 */
  MESSAGE_QUEUE: 'message.queue'
} as const;

