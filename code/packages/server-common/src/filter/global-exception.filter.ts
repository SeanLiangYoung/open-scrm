/**
 * 全局异常过滤器
 */

import { Catch, Logger } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';

@Catch()
export class GlobalExceptionFilter {
  @Logger()
  logger;

  async catch(err: Error, ctx: Context) {
    // 记录错误日志
    this.logger.error('[GlobalException]', err);

    // 返回统一错误格式
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: process.env.NODE_ENV === 'production' 
        ? '服务器内部错误' 
        : err.message,
      timestamp: new Date().toISOString(),
      path: ctx.url,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    };
  }
}

