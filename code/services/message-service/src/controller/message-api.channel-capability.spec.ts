import { describe, expect, it, vi } from 'vitest';
import { MessageApiController } from './message-api.controller';
import { MessageSendService } from '../service/message-send.service';

function setup() {
  const consent = vi.fn().mockResolvedValue(true);
  const policy = vi.fn().mockResolvedValue({ allowed: true });
  const create = vi.fn((row: object) => ({ id: 1, retryCount: 0, ...row }));
  const save = vi.fn(async (row: object) => row);
  const findOne = vi.fn().mockResolvedValue(null);
  const external = vi.fn(() => { throw new Error('No external provider may be invoked in this regression'); });
  const sender = Object.assign(new MessageSendService(), {
    messageLogRepository: { create, save, findOne },
    httpService: { request: external, post: external },
  });
  const controller = Object.assign(new MessageApiController(), {
    ctx: { get: (name: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' }[name] || '') },
    consentRecordService: { hasActiveMarketingConsentForCustomer: consent },
    outboundPolicyStateService: { tryConsumeMarketingSendSlot: policy },
    messageSendService: sender,
  });
  return { controller, consent, policy, create, save, findOne, external };
}

describe('API channel capability must reject before consent and marketing quota side effects', () => {
  it.each([1, 2, 3, 4])('unconnected channel %i does not inspect consent, consume a slot, or write logs', async messageType => {
    const t = setup();
    await expect(t.controller.send(undefined, {
      messageType, targetType: 1, targetIds: [9], content: 'marketing test',
      consentPurpose: 'marketing', regionPackId: 'th-bangkok',
    })).rejects.toMatchObject({ status: 400 });
    // Both premature operations must be visible in the failing regression.
    expect.soft(t.consent).not.toHaveBeenCalled();
    expect.soft(t.policy).not.toHaveBeenCalled();
    expect(t.create).not.toHaveBeenCalled();
    expect(t.save).not.toHaveBeenCalled();
    expect(t.findOne).not.toHaveBeenCalled();
    expect(t.external).not.toHaveBeenCalled();
  });
  it('Mock5 marketing cannot consume quota before rejecting historical channel1 key', async () => {
    const t = setup();
    t.findOne.mockResolvedValue({ id: 42, corpId: '2', messageType: 1, sendStatus: 1,
      content: 'historical placeholder', idempotencyKey: 'historical' });
    await expect(t.controller.send(undefined, {
      messageType: 5, targetType: 1, targetIds: [9], content: 'explicit mock',
      consentPurpose: 'marketing', regionPackId: 'th-bangkok', idempotencyKey: 'historical',
    })).rejects.toMatchObject({ status: 400 });
    expect.soft(t.consent).not.toHaveBeenCalled();
    expect.soft(t.policy).not.toHaveBeenCalled();
    expect(t.findOne).toHaveBeenCalledWith({ where: { corpId: 2, idempotencyKey: 'historical' } });
    expect(t.create).not.toHaveBeenCalled();
    expect(t.save).not.toHaveBeenCalled();
    expect(t.external).not.toHaveBeenCalled();
  });
  it('explicit Mock5 still checks consent and quota before its real local sender writes', async () => {
    const t = setup();
    expect(await t.controller.send(undefined, {
      messageType: 5, targetType: 1, targetIds: [9], content: 'explicit mock',
      consentPurpose: 'marketing', regionPackId: 'th-bangkok',
    })).toMatchObject({ success: true, data: { total: 1, success: 1, failed: 0 } });
    expect(t.consent).toHaveBeenCalledWith(2, 9);
    expect(t.policy).toHaveBeenCalledTimes(1);
    expect(t.policy).toHaveBeenCalledWith(expect.objectContaining({ corpId: 2, targetId: 9 }));
    expect(t.save).toHaveBeenCalledTimes(2);
    expect(t.external).not.toHaveBeenCalled();
  });
});
