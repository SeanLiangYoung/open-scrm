/**
 * 客户状态枚举
 */
export enum CustomerStatus {
  /** 已删除 */
  DELETED = 0,
  /** 正常 */
  ACTIVE = 1,
  /** 流失 */
  LOST = 2
}

/**
 * 客户类型枚举
 */
export enum CustomerType {
  /** 微信 */
  WECHAT = 1,
  /** 企业微信 */
  WEWORK = 2
}

/**
 * 性别枚举
 */
export enum Gender {
  /** 未知 */
  UNKNOWN = 0,
  /** 男性 */
  MALE = 1,
  /** 女性 */
  FEMALE = 2
}

