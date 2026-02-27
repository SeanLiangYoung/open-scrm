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

  private adminOnlyPaths = ['/api/v1/users'];

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 白名单路径 - 不需要认证
      const whitelist = ['/api/v1/auth/login', '/api/v1/auth/register', '/health', '/metrics'];

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
        const payload = (await this.jwtService.verify(token)) as unknown as {
          userId: number;
          corpId: number;
          username: string;
          isAdmin: boolean;
          roles: string[];
        };

        // 将用户信息挂载到ctx上
        ctx.state.user = payload;

        // 检查是否需要管理员权限
        if (this.requiresAdmin(ctx.path) && !payload.isAdmin) {
          ctx.status = 403;
          ctx.body = {
            code: 403,
            message: '权限不足，需要管理员权限',
            timestamp: new Date().toISOString()
          };
          return;
        }

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

  private requiresAdmin(path: string): boolean {
    return this.adminOnlyPaths.some(adminPath => path.startsWith(adminPath));
  }

  static getName(): string {
    return 'auth';
  }
}
