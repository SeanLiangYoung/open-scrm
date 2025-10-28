/**
 * HTTP异常过滤器
 */

import { Catch, MidwayHttpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';

@Catch(MidwayHttpError)
export class HttpExceptionFilter {
  async catch(err: MidwayHttpError, ctx: Context) {
    // 记录错误日志
    ctx.logger.error('[HttpException]', err);

    // 返回统一错误格式
    ctx.status = err.status || 500;
    ctx.body = {
      code: err.status || 500,
      message: err.message || '服务器内部错误',
      timestamp: new Date().toISOString(),
      path: ctx.url
    };
  }
}

