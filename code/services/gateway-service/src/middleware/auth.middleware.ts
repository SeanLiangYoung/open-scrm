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
      // Refresh authenticates its own signed refresh credential in auth-service.
      // An expired access token must not prevent the client from renewing it.
      if (ctx.path === '/api/v1/auth/refresh-token') {
        return await next();
      }
      // 白名单路径 - 不需要认证
      const whitelist = [
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/health',
        '/metrics',
        '/api/health-check',
        // 各服务经网关暴露的只读探测（无需登录）
        '/api/v1/integration/health',
        // 企微被动回调：GET/POST 由企微服务器调用，无 Bearer Token
        '/api/v1/integration/wework/callback'
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
        const payload = (await this.jwtService.verify(token)) as unknown as {
          userId: number;
          corpId: number;
          username: string;
          isAdmin: boolean | number;
          roles: string[];
          type?: string;
        };

        const validIdentity = [payload.userId, payload.corpId].every(
          value =>
            ['number', 'string'].includes(typeof value) &&
            /^[1-9]\d*$/.test(String(value)) &&
            Number.isSafeInteger(Number(value))
        );
        if (!validIdentity || (payload.type !== undefined && payload.type !== 'access')) {
          throw new Error('无效的访问Token身份或用途');
        }

        // 将用户信息挂载到ctx上
        const isAdmin = payload.isAdmin === true || payload.isAdmin === 1;
        ctx.state.user = { ...payload, isAdmin };

        // 检查是否需要管理员权限
        if (this.requiresAdmin(ctx.path) && !isAdmin) {
          ctx.status = 403;
          ctx.body = {
            code: 403,
            message: '权限不足，需要管理员权限',
            timestamp: new Date().toISOString()
          };
          return;
        }
      } catch (error) {
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: 'Token无效或已过期',
          timestamp: new Date().toISOString()
        };
        return;
      }
      // Authentication has succeeded; let business errors retain their status.
      await next();
    };
  }

  private requiresAdmin(path: string): boolean {
    return this.adminOnlyPaths.some(adminPath => path.startsWith(adminPath));
  }

  static getName(): string {
    return 'auth';
  }
}
