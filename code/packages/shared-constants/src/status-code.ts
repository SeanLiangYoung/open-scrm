/**
 * HTTP状态码常量
 */

export const StatusCode = {
  /** 成功 */
  SUCCESS: 200,
  
  /** 创建成功 */
  CREATED: 201,
  
  /** 无内容 */
  NO_CONTENT: 204,
  
  /** 错误的请求 */
  BAD_REQUEST: 400,
  
  /** 未授权 */
  UNAUTHORIZED: 401,
  
  /** 禁止访问 */
  FORBIDDEN: 403,
  
  /** 未找到 */
  NOT_FOUND: 404,
  
  /** 请求超时 */
  REQUEST_TIMEOUT: 408,
  
  /** 请求过多 */
  TOO_MANY_REQUESTS: 429,
  
  /** 服务器错误 */
  INTERNAL_SERVER_ERROR: 500,
  
  /** 服务不可用 */
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * 业务错误码
 */
export const ErrorCode = {
  /** 参数错误 */
  INVALID_PARAMS: 10001,
  
  /** 用户不存在 */
  USER_NOT_FOUND: 10002,
  
  /** 用户已存在 */
  USER_EXISTS: 10003,
  
  /** 密码错误 */
  PASSWORD_ERROR: 10004,
  
  /** Token无效 */
  INVALID_TOKEN: 10005,
  
  /** Token过期 */
  TOKEN_EXPIRED: 10006,
  
  /** 权限不足 */
  PERMISSION_DENIED: 10007,
  
  /** 客户不存在 */
  CUSTOMER_NOT_FOUND: 20001,
  
  /** 标签不存在 */
  TAG_NOT_FOUND: 20002,
  
  /** SOP不存在 */
  SOP_NOT_FOUND: 30001,
  
  /** SOP执行失败 */
  SOP_EXECUTION_FAILED: 30002,
  
  /** 第三方API调用失败 */
  THIRD_PARTY_API_ERROR: 40001,
  
  /** 企微API错误 */
  WEWORK_API_ERROR: 40002,
  
  /** 抖音API错误 */
  DOUYIN_API_ERROR: 40003,
  
  /** 小红书API错误 */
  XHS_API_ERROR: 40004
} as const;

