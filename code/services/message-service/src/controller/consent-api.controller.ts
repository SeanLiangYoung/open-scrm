import { Body, Controller, Inject, Post, httpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { ConsentRecordService } from '../service/consent-record.service';

interface ConsentSubjectInput { customerId: number; purpose: 'marketing' }
interface ConsentGrantInput extends ConsentSubjectInput {
  policyVersion: string;
  channel: string;
  locale: string;
}

/** Internal service: gateway must authenticate JWT and overwrite identity headers. */
@Controller('/api/v1/messages/consents')
export class ConsentApiController {
  @Inject()
  ctx!: Context;

  @Inject()
  consentRecordService!: ConsentRecordService;

  @Post('/grant')
  async grant(@Body() body: unknown) {
    const corpId = this.requestCorpId();
    const input = this.parseBody(body, true) as ConsentGrantInput;
    const data = await this.consentRecordService.grantMarketingConsent(corpId, input);
    return { success: true, data };
  }

  @Post('/revoke')
  async revoke(@Body() body: unknown) {
    const corpId = this.requestCorpId();
    const input = this.parseBody(body, false);
    const data = await this.consentRecordService.revokeMarketingConsent(corpId, input.customerId);
    return { success: true, data };
  }

  private requestCorpId(): number {
    const header = this.ctx.get('x-corp-id');
    const identity = header
      ? { corpId: header, userId: this.ctx.get('x-user-id') }
      : this.ctx.state?.user;
    if (!identity || ![identity.corpId, identity.userId].every(value =>
      ['number', 'string'].includes(typeof value) && /^[1-9]\d*$/.test(String(value)) && Number.isSafeInteger(Number(value))
    )) throw new httpError.UnauthorizedError('缺少有效企业与操作者身份，请通过网关访问');
    return Number(identity.corpId);
  }

  private parseBody(body: unknown, grant: boolean): ConsentSubjectInput | ConsentGrantInput {
    const invalid = () => { throw new httpError.BadRequestError('同意记录参数无效'); };
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid();
    const input = body as Record<string, unknown>;
    const keys = grant ? ['customerId', 'purpose', 'policyVersion', 'channel', 'locale'] : ['customerId', 'purpose'];
    if (Object.keys(input).some(key => !keys.includes(key)) ||
      typeof input.customerId !== 'number' || !Number.isSafeInteger(input.customerId) || input.customerId < 1 || input.purpose !== 'marketing') return invalid();
    const subject: ConsentSubjectInput = { customerId: input.customerId, purpose: 'marketing' };
    if (!grant) return subject;
    if (typeof input.policyVersion !== 'string' || !input.policyVersion.trim() || input.policyVersion.length > 64 ||
      typeof input.channel !== 'string' || !['web', 'line_oa', 'whatsapp', 'email', 'other'].includes(input.channel) ||
      typeof input.locale !== 'string' || input.locale.length > 16) return invalid();
    try { if (!Intl.getCanonicalLocales(input.locale).length) return invalid(); }
    catch { return invalid(); }
    return { ...subject, policyVersion: input.policyVersion.trim(), channel: input.channel, locale: input.locale };
  }
}
