import { Config, Inject, Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { IMiddleware } from '@midwayjs/core';
import { HttpService } from '@midwayjs/axios';

interface RouteConfig {
  path: string;
  target: string;
}

@Middleware()
export class ProxyMiddleware implements IMiddleware<Context, NextFunction> {
  @Config('gateway.routes')
  routes: RouteConfig[];

  @Inject()
  httpService: HttpService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const matchedRoute = this.findMatchingRoute(ctx.path);

      if (!matchedRoute) {
        return await next();
      }

      try {
        const targetUrl = `${matchedRoute.target}${ctx.path}`;
        const headers: Record<string, string> = {};

        if (ctx.get('authorization')) {
          headers['authorization'] = ctx.get('authorization');
        }
        if (ctx.get('content-type')) {
          headers['content-type'] = ctx.get('content-type');
        }
        if (ctx.state.user) {
          headers['x-user-id'] = String(ctx.state.user.userId || '');
          headers['x-corp-id'] = String(ctx.state.user.corpId || '');
          headers['x-username'] = String(ctx.state.user.username || '');
          headers['x-is-admin'] = String(ctx.state.user.isAdmin || false);
        }

        const response = await this.httpService.request({
          method: ctx.method as any,
          url: targetUrl,
          headers,
          data: ctx.method !== 'GET' ? ctx.request.body : undefined,
          params: ctx.query,
          timeout: 30000,
          validateStatus: () => true,
        });

        ctx.status = response.status;
        ctx.body = response.data;

        const proxyHeaders = [
          'content-type',
          'x-request-id',
          'x-ratelimit-limit',
          'x-ratelimit-remaining',
        ];
        for (const key of proxyHeaders) {
          if (response.headers[key]) {
            ctx.set(key, response.headers[key] as string);
          }
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          ctx.status = 503;
          ctx.body = {
            code: 503,
            message: '目标服务不可用',
            timestamp: new Date().toISOString(),
          };
        } else {
          ctx.status = 502;
          ctx.body = {
            code: 502,
            message: '网关代理错误',
            timestamp: new Date().toISOString(),
          };
        }
      }
    };
  }

  private findMatchingRoute(path: string): RouteConfig | undefined {
    return this.routes.find(route => {
      const routePath = route.path.replace('/*', '');
      return path.startsWith(routePath);
    });
  }

  static getName(): string {
    return 'proxy';
  }
}
