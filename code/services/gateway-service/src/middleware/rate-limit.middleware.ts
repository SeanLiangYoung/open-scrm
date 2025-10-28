import { Inject, Middleware, Config } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { RedisService } from '@midwayjs/redis';
import { IMiddleware } from '@midwayjs/core';

/**
 * 限流中间件
 */
@Middleware()
export class RateLimitMiddleware implements IMiddleware<Context, NextFunction> {
  @Inject()
  redisService: RedisService;

  @Config('rateLimit')
  rateLimitConfig: { max: number; duration: number };

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const key = `rate_limit:${ctx.ip}:${ctx.path}`;
      const { max, duration } = this.rateLimitConfig;
      const ttl = Math.floor(duration / 1000);

      try {
        // 获取当前计数
        const current = await this.redisService.incr(key);

        if (current === 1) {
          // 第一次请求，设置过期时间
          await this.redisService.expire(key, ttl);
        }

        // 检查是否超过限制
        if (current > max) {
          ctx.status = 429;
          ctx.body = {
            code: 429,
            message: '请求过于频繁，请稍后再试',
            timestamp: new Date().toISOString()
          };
          return;
        }

        // 设置响应头
        ctx.set('X-RateLimit-Limit', max.toString());
        ctx.set('X-RateLimit-Remaining', Math.max(0, max - current).toString());
        ctx.set('X-RateLimit-Reset', (Date.now() + duration).toString());

        await next();
      } catch (error) {
        // Redis错误时不阻塞请求
        console.error('Rate limit error:', error);
        await next();
      }
    };
  }

  static getName(): string {
    return 'rateLimit';
  }
}

