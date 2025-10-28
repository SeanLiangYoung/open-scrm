/**
 * 响应拦截器 - 统一响应格式
 */

import { Middleware, IMiddleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

@Middleware()
export class ResponseInterceptor implements IMiddleware<Context, NextFunction> {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const startTime = Date.now();

      await next();

      // 统一响应格式
      const body: any = ctx.body;
      if (body && typeof body === 'object' && !body.code) {
        ctx.body = {
          code: ctx.status || 200,
          message: 'success',
          data: body,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime
        };
      }
    };
  }
}

