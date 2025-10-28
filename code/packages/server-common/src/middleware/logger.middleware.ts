/**
 * 日志中间件
 */

import { Middleware, IMiddleware, Logger } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';

@Middleware()
export class LoggerMiddleware implements IMiddleware<Context, NextFunction> {
  @Logger()
  logger;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const startTime = Date.now();

      // 记录请求开始
      this.logger.info(`→ ${ctx.method} ${ctx.url}`);

      try {
        await next();

        // 记录请求结束
        const duration = Date.now() - startTime;
        this.logger.info(
          `← ${ctx.method} ${ctx.url} ${ctx.status} ${duration}ms`
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error(
          `✖ ${ctx.method} ${ctx.url} ${ctx.status} ${duration}ms`,
          error
        );
        throw error;
      }
    };
  }

  static getName(): string {
    return 'logger';
  }
}

