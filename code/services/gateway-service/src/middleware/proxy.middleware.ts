import { createReadStream, ReadStream } from 'fs';
import { mkdtemp, open, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Config, Inject, Middleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { IMiddleware } from '@midwayjs/core';
import { HttpService } from '@midwayjs/axios';
import {
  findMatchingGatewayRoute,
  gatewayUpstreamPath,
  type GatewayRouteConfig
} from '../utils/route-match';

@Middleware()
export class ProxyMiddleware implements IMiddleware<Context, NextFunction> {
  @Config('gateway.routes')
  routes: GatewayRouteConfig[];

  @Inject()
  httpService: HttpService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const matchedRoute = findMatchingGatewayRoute(this.routes, ctx.path);

      if (!matchedRoute) {
        return await next();
      }

      let uploadDirectory: string | undefined;
      let uploadStream: ReadStream | undefined;
      try {
        const targetUrl = `${matchedRoute.target}${gatewayUpstreamPath(matchedRoute, ctx.path)}`;
        const headers: Record<string, string> = {};

        if (ctx.get('authorization')) {
          headers['authorization'] = ctx.get('authorization');
        }
        if (ctx.get('content-type')) {
          headers['content-type'] = ctx.get('content-type');
        }
        if (ctx.get('idempotency-key')) {
          headers['idempotency-key'] = ctx.get('idempotency-key');
        }
        if (ctx.state.user) {
          headers['x-user-id'] = String(ctx.state.user.userId || '');
          headers['x-corp-id'] = String(ctx.state.user.corpId || '');
          headers['x-username'] = String(ctx.state.user.username || '');
          headers['x-is-admin'] = String(ctx.state.user.isAdmin || false);
        }

        const isLlmHeavyRoute = ctx.path.startsWith('/api/v1/content-studio/');

        const isMultipartUpload =
          ctx.method === 'POST' &&
          ['/api/v1/assets/upload', '/api/asset/upload'].includes(ctx.path) &&
          /^multipart\/form-data(?:;|$)/i.test(ctx.get('content-type'));
        const proxyTimeoutMs = isLlmHeavyRoute || isMultipartUpload ? 120_000 : 30_000;
        let data = ctx.method !== 'GET' ? ctx.request.body : undefined;
        // Complete a bounded disk spool before contacting asset-service: a chunked
        // oversized request must not create an upstream object or database row.
        const multipartLimit = 101 * 1024 * 1024;
        if (isMultipartUpload) {
          if (!ctx.state.user) {
            ctx.status = 401;
            ctx.body = { code: 401, message: '未授权访问' };
            return;
          }
          if (Number(ctx.get('content-length')) > multipartLimit) {
            throw Object.assign(new Error('Multipart upload too large'), { status: 413 });
          }
          uploadDirectory = await mkdtemp(join(tmpdir(), 'scrm-gateway-upload-'));
          const spoolPath = join(uploadDirectory, 'body');
          const file = await open(spoolPath, 'wx', 0o600);
          let size = 0;
          try {
            // Do not destroy the HTTP socket on limit failure: Koa still sends 413.
            for await (const chunk of ctx.req.iterator({ destroyOnReturn: false })) {
              const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
              size += bytes.length;
              if (size > multipartLimit) {
                throw Object.assign(new Error('Multipart upload too large'), { status: 413 });
              }
              await file.writeFile(bytes);
            }
          } finally {
            await file.close();
          }
          uploadStream = createReadStream(spoolPath);
          data = uploadStream;
          headers['content-length'] = String(size);
        }

        const response = await this.httpService.request({
          method: ctx.method as any,
          url: targetUrl,
          headers,
          data,
          ...(isMultipartUpload ? { maxBodyLength: multipartLimit, maxRedirects: 0 } : {}),
          params: ctx.query,
          timeout: proxyTimeoutMs,
          validateStatus: () => true
        });

        ctx.status = response.status;
        ctx.body = response.data;

        const proxyHeaders = [
          'content-type',
          'x-request-id',
          'x-ratelimit-limit',
          'x-ratelimit-remaining'
        ];
        for (const key of proxyHeaders) {
          if (response.headers[key]) {
            ctx.set(key, response.headers[key] as string);
          }
        }
      } catch (error) {
        if (error.status === 413) {
          ctx.req.resume();
          ctx.status = 413;
          ctx.body = {
            code: 413,
            message: '上传请求超过101MiB限制',
            timestamp: new Date().toISOString()
          };
        } else if (error.code === 'ECONNREFUSED') {
          ctx.status = 503;
          ctx.body = {
            code: 503,
            message: '目标服务不可用',
            timestamp: new Date().toISOString()
          };
        } else {
          ctx.status = 502;
          ctx.body = {
            code: 502,
            message: '网关代理错误',
            timestamp: new Date().toISOString()
          };
        }
      } finally {
        uploadStream?.destroy();
        if (uploadDirectory) {
          try {
            await rm(uploadDirectory, { recursive: true, force: true });
          } catch (error) {
            // The upstream may already have committed. Local housekeeping must
            // never replace that response or invite a duplicate client retry.
            ctx.logger.warn('Gateway upload spool cleanup failed', {
              directory: uploadDirectory,
              error
            });
          }
        }
      }
    };
  }

  static getName(): string {
    return 'proxy';
  }
}
