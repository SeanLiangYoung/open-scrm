import { Middleware, IMiddleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { requireTemplateNumber } from '../util/message-identity.util';

/** Only templateId errors become400; other existing DTO failures retain framework422. */
@Middleware()
export class TemplateReferenceInputMiddleware implements IMiddleware<Context, NextFunction> {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const body = ctx.request.body;
      if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'templateId')) {
        requireTemplateNumber((body as Record<string, unknown>).templateId);
      }
      return await next();
    };
  }
}
