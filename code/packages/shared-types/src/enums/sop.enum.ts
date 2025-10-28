/**
 * SOP相关枚举
 */

/**
 * SOP模板类型
 */
export enum SopTemplateType {
  /** 客户SOP */
  CUSTOMER = 1,
  /** 社群SOP */
  GROUP = 2
}

/**
 * SOP触发类型
 */
export enum SopTriggerType {
  /** 添加好友 */
  ADD_FRIEND = 1,
  /** 打标签 */
  TAG = 2,
  /** 加入社群 */
  JOIN_GROUP = 3
}

/**
 * SOP步骤类型
 */
export enum SopStepType {
  /** 发送消息 */
  SEND_MESSAGE = 1,
  /** 打标签 */
  ADD_TAG = 2,
  /** 推送素材 */
  PUSH_MATERIAL = 3
}

/**
 * SOP状态
 */
export enum SopStatus {
  /** 已禁用 */
  DISABLED = 0,
  /** 启用中 */
  ACTIVE = 1
}

/**
 * SOP执行状态
 */
export enum SopExecutionStatus {
  /** 执行中 */
  RUNNING = 0,
  /** 已完成 */
  COMPLETED = 1,
  /** 已暂停 */
  PAUSED = 2
}

/**
 * 延时单位
 */
export enum DelayUnit {
  /** 分钟 */
  MINUTE = 'minute',
  /** 小时 */
  HOUR = 'hour',
  /** 天 */
  DAY = 'day'
}

/**
 * SOP动作类型
 */
export enum SopActionType {
  /** 发送文本消息 */
  SEND_TEXT = 1,
  /** 发送图片 */
  SEND_IMAGE = 2,
  /** 发送链接 */
  SEND_LINK = 3,
  /** 发送小程序 */
  SEND_MINIPROGRAM = 4,
  /** 打标签 */
  ADD_TAG = 5,
  /** 移除标签 */
  REMOVE_TAG = 6
}

