import { describe, it, expect, vi } from 'vitest';
import { MessageApiController } from '../controller/message-api.controller';
import { MessageSendService } from './message-send.service';
import { ConsentRecordService } from './consent-record.service';
import { resolveMarketingConsentGate } from '../util/marketing-consent-gate.util';
const grant = { customerId: 7, purpose: 'marketing' as const, policyVersion: 'privacy-v1', channel: 'web', locale: 'th-TH' };
function fixture(customerExists = true) {
  const rows: any[] = [];
  const scoped = (row: any, where: any) => Object.entries(where).every(([k, v]) => k === 'revokedAt' ? row[k] === null : row[k] === v);
  const repo = {
    create: (data: any) => ({ id: rows.length + 1, ...data }),
    save: vi.fn(async (row: any) => { rows.push(row); return row; }),
    findOne: vi.fn(async ({ where }: any) => rows.find(row => scoped(row, where)) || null),
    update: vi.fn(async (where: any, patch: any) => {
      let affected = 0;
      for (const row of rows) if (scoped(row, where)) { Object.assign(row, patch); affected++; }
      return { affected };
    }),
    manager: {} as any,
  };
  const query = vi.fn(async () => customerExists ? [{ id: 7 }] : []);
  const transaction = vi.fn(async (work: any) => work({ query, getRepository: () => repo }));
  repo.manager = { transaction };
  const service = new ConsentRecordService();
  service.consentRepository = repo as any;
  return { service, repo, rows, query, transaction };
}
describe('Consent write closed loop', () => {
  it('grant persists metadata within authenticated tenant and enables marketing', async () => {
    const { service, rows, query } = fixture();
    await service.grantMarketingConsent(3, grant);
    expect(rows[0]).toMatchObject({ corpId: 3, subjectType: 'customer', subjectId: 7, purpose: 'marketing', policyVersion: 'privacy-v1', channel: 'web', locale: 'th-TH', revokedAt: null });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [7, 3]);
    expect(await service.hasActiveMarketingConsentForCustomer(3, 7)).toBe(true);
    expect(await service.hasActiveMarketingConsentForCustomer(4, 7)).toBe(false);
  });
  it('revokes all active grants and blocks marketing while preserving other tenants and evidence', async () => {
    const { service, rows } = fixture();
    await service.grantMarketingConsent(3, grant);
    await service.grantMarketingConsent(3, { ...grant, policyVersion: 'privacy-v2' });
    await service.grantMarketingConsent(4, grant);
    expect(await service.revokeMarketingConsent(3, 7)).toEqual({ revokedCount: 2 });
    expect(rows[0].revokedAt).toBeInstanceOf(Date);
    expect(rows[0].policyVersion).toBe('privacy-v1');
    expect(await resolveMarketingConsentGate(3, { consentPurpose: 'marketing', targetType: 1, targetIds: [7] }, (corp, id) => service.hasActiveMarketingConsentForCustomer(corp, id))).toMatchObject({ status: 403 });
    expect(await service.hasActiveMarketingConsentForCustomer(4, 7)).toBe(true);
    expect(await service.revokeMarketingConsent(3, 7)).toEqual({ revokedCount: 0 });
    await service.grantMarketingConsent(3, grant);
    expect(await service.hasActiveMarketingConsentForCustomer(3, 7)).toBe(true);
  });
  it('a send starting after revoke returns 403 before policy slots or outbound dispatch', async () => {
    const { service } = fixture();
    await service.grantMarketingConsent(3, grant);
    await service.revokeMarketingConsent(3, 7);
    const controller = new MessageApiController();
    controller.ctx = { get: (key: string) => key === 'x-corp-id' ? '3' : '9', state: {} } as any;
    controller.consentRecordService = service;
    const sendMessage = vi.fn();
    const tryConsumeMarketingSendSlot = vi.fn();
    controller.messageSendService = Object.assign(new MessageSendService(), { sendMessage });
    controller.outboundPolicyStateService = { tryConsumeMarketingSendSlot } as any;
    expect(await controller.send(undefined, {
      messageType: 5, targetType: 1, targetIds: [7], content: 'mock', consentPurpose: 'marketing',
    })).toMatchObject({ success: false });
    expect(controller.ctx.status).toBe(403);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(tryConsumeMarketingSendSlot).not.toHaveBeenCalled();
  });
  it('does not write consent for missing or foreign-tenant customer', async () => {
    const { service, repo } = fixture(false);
    await expect(service.grantMarketingConsent(3, grant)).rejects.toThrow('客户不存在');
    await expect(service.revokeMarketingConsent(3, 7)).rejects.toThrow('客户不存在');
    expect(repo.save).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
