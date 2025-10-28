import { Inject, Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { JwtService } from '@midwayjs/jwt';
import { IMiddleware } from '@midwayjs/core';

/**
 * 认证中间件
 */
@Middleware()
export class AuthMiddleware implements IMiddleware<Context, NextFunction> {
  @Inject()
  jwtService: JwtService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 白名单路径 - 不需要认证
      const whitelist = [
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/health',
        '/metrics'
      ];

      // 检查是否在白名单中
      if (whitelist.some(path => ctx.path.startsWith(path))) {
        return await next();
      }

      // 获取Token
      const authHeader = ctx.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: '未授权，请先登录',
          timestamp: new Date().toISOString()
        };
        return;
      }

      const token = authHeader.substring(7);

      try {
        // 验证Token
        const payload = await this.jwtService.verify(token);

        // 将用户信息挂载到ctx上
        ctx.state.user = payload;

        await next();
      } catch (error) {
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: 'Token无效或已过期',
          timestamp: new Date().toISOString()
        };
      }
    };
  }

  static getName(): string {
    return 'auth';
  }
}

