import { Controller, Get, Inject, Query, httpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { ObservedDailyService } from '../service/observed-daily.service';
import { parseObservedWindow } from '../util/observed-daily.util';
@Controller('/api/v1/analytics')
export class ObservedDailyController {
  @Inject()
  ctx!: Context;
  @Inject()
  observedDailyService!: ObservedDailyService;
  @Get('/observed-daily')
  async read(@Query() query: Record<string, unknown>) {
    const corpId = this.requestCorpId();
    try { parseObservedWindow(query); }
    catch (error: unknown) { this.ctx.throw(400, error instanceof Error ? error.message : '日期查询无效'); }
    return { success: true, data: await this.observedDailyService.read(corpId, query) };
  }
  private requestCorpId(): number {
    const corpHeader = this.ctx.get('x-corp-id');
    const userHeader = this.ctx.get('x-user-id');
    // A malformed or partial supplied identity must never borrow fields from state.
    const headers = this.ctx.headers || {};
    const hasHeaders = !!corpHeader || !!userHeader ||
      ['x-corp-id', 'x-user-id'].some(key => Object.prototype.hasOwnProperty.call(headers, key));
    const identity = hasHeaders ? { corpId: corpHeader, userId: userHeader } : this.ctx.state?.user;
    if (!identity || ![identity.corpId, identity.userId].every(value =>
      ['string', 'number'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
    )) throw new httpError.UnauthorizedError('缺少有效企业与操作者身份，请通过网关访问');
    return Number(identity.corpId);
  }
}
