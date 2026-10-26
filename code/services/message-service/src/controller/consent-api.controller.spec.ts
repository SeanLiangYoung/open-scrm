import { describe, it, expect, vi } from 'vitest';
import { ConsentApiController } from './consent-api.controller';
function fixture(headers: Record<string, string> = { 'x-corp-id': '3', 'x-user-id': '9' }) {
  const controller = new ConsentApiController();
  controller.ctx = { get: (key: string) => headers[key] || '', state: {} } as any;
  controller.consentRecordService = { grantMarketingConsent: vi.fn().mockResolvedValue({ id: 10 }), revokeMarketingConsent: vi.fn().mockResolvedValue({ revokedCount: 2 }) } as any;
  return controller;
}
const body = { customerId: 7, purpose: 'marketing', policyVersion: 'v1', channel: 'web', locale: 'th-TH' };
describe('ConsentApiController', () => {
  it('uses trusted request tenant and returns grant evidence', async () => {
    const c = fixture();
    expect(await c.grant(body)).toEqual({ success: true, data: { id: 10 } });
    expect(c.consentRecordService.grantMarketingConsent).toHaveBeenCalledWith(3, body);
  });
  it('revokes a customer purpose and reports affected count', async () => {
    const c = fixture();
    expect(await c.revoke({ customerId: 7, purpose: 'marketing' })).toEqual({ success: true, data: { revokedCount: 2 } });
    expect(c.consentRecordService.revokeMarketingConsent).toHaveBeenCalledWith(3, 7);
  });
  it.each([{}, { 'x-corp-id': '3' }, { 'x-corp-id': '3oops', 'x-user-id': '9' }, { 'x-corp-id': '0', 'x-user-id': '9' }])('fails closed without valid complete identity: %s', async headers => {
    const c = fixture(headers);
    await expect(c.grant(body)).rejects.toMatchObject({ status: 401 });
    await expect(c.revoke({ customerId: 7, purpose: 'marketing' })).rejects.toMatchObject({ status: 401 });
    expect(c.consentRecordService.grantMarketingConsent).not.toHaveBeenCalled();
  });
  it.each([
    null, {}, { ...body, corpId: 4 }, { ...body, userId: 9 }, { ...body, customerId: '7' },
    { ...body, customerId: -1 }, { ...body, customerId: 1.5 },
    { ...body, purpose: 'transactional' }, { ...body, policyVersion: '  ' },
    { ...body, policyVersion: 'a'.repeat(65) }, { ...body, channel: 'invalid' },
    { ...body, locale: 'not_a_locale' }, { ...body, locale: 'a'.repeat(17) },
  ])('rejects invalid grant body before persistence: %s', async input => {
    const c = fixture();
    await expect(c.grant(input)).rejects.toMatchObject({ status: 400 });
    expect(c.consentRecordService.grantMarketingConsent).not.toHaveBeenCalled();
  });
  it('accepts complete validated local JWT identity when gateway headers are absent', async () => {
    const c = fixture({});
    c.ctx.state.user = { corpId: 5, userId: 9 };
    await c.grant(body);
    expect(c.consentRecordService.grantMarketingConsent).toHaveBeenCalledWith(5, body);
  });
  it('rejects unknown revoke fields and unsupported purposes', async () => {
    const c = fixture();
    for (const input of [{ customerId: 7, purpose: 'marketing', corpId: 4 }, { customerId: 7, purpose: 'marketing', userId: 9 }, { customerId: 7, purpose: 'profiling' }, null]) {
      await expect(c.revoke(input)).rejects.toMatchObject({ status: 400 });
    }
    expect(c.consentRecordService.revokeMarketingConsent).not.toHaveBeenCalled();
  });
});
