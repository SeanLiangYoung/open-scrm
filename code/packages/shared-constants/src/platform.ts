/**
 * 第三方平台常量
 */

/**
 * 平台类型
 */
export const PLATFORM = {
  /** 企业微信 */
  WEWORK: 'wework',
  
  /** 抖音 */
  DOUYIN: 'douyin',
  
  /** 小红书 */
  XIAOHONGSHU: 'xiaohongshu',
  
  /** 微信 */
  WECHAT: 'wechat'
} as const;

/**
 * 企业微信配置
 */
export const WEWORK = {
  /** API域名 */
  API_DOMAIN: 'https://qyapi.weixin.qq.com',
  
  /** 获取Token接口 */
  GET_TOKEN_URL: '/cgi-bin/gettoken',
  
  /** 获取客户列表接口 */
  GET_EXTERNAL_CONTACT_LIST: '/cgi-bin/externalcontact/list',
  
  /** 发送消息接口 */
  SEND_MESSAGE_URL: '/cgi-bin/message/send'
} as const;

/**
 * 抖音配置
 */
export const DOUYIN = {
  /** API域名 */
  API_DOMAIN: 'https://open.douyin.com',
  
  /** OAuth授权地址 */
  OAUTH_URL: 'https://open.douyin.com/platform/oauth/connect'
} as const;

/**
 * 小红书配置
 */
export const XIAOHONGSHU = {
  /** API域名 */
  API_DOMAIN: 'https://open.xiaohongshu.com',
  
  /** OAuth授权地址 */
  OAUTH_URL: 'https://open.xiaohongshu.com/oauth/authorize'
} as const;

