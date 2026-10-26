import { Controller, Get, Inject, Param, Query, httpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { ConsentReadService } from '../service/consent-read.service';
import { parseConsentReadInput } from '../dto/consent-read.dto';

@Controller('/api/v1/messages/consents')
export class ConsentReadController {
  @Inject() ctx!: Context;
  @Inject() consentReadService!: ConsentReadService;

  @Get('/customer/:customerId')
  async read(@Param('customerId') customerId: string, @Query() query: unknown) {
    const header = this.ctx.get('x-corp-id');
    const identity = header ? { corpId: header, userId: this.ctx.get('x-user-id') } : this.ctx.state?.user;
    if (!identity || ![identity.corpId, identity.userId].every(value =>
      ['number', 'string'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
    )) throw new httpError.UnauthorizedError('缺少有效企业与操作者身份，请通过网关访问');
    const input = parseConsentReadInput(customerId, query);
    return { success: true, data: await this.consentReadService.readCustomerConsent(Number(identity.corpId), input.customerId, input.pagination) };
  }
}
