import { describe, expect, it, vi } from 'vitest';
import { MessageSendService } from './message-send.service';

function fixture() {
  const repository = {
    findOne: vi.fn(), find: vi.fn(),
    create: vi.fn(value => ({ ...value, id: 123, retryCount: 0 })),
    save: vi.fn(async value => value),
  };
  const service = new MessageSendService();
  Object.assign(service, {
    messageLogRepository: repository,
    messageConfig: { batchSize: 100, batchInterval: 1, maxRetries: 3 },
    messageTemplateService: { getTemplate: vi.fn(), renderTemplate: vi.fn(() => 'template') },
    httpService: { post: vi.fn() },
  });
  return { service, repository };
}

describe('explicit message channel capabilities', () => {
  for (const messageType of [1, 2, 3, 4]) {
    it(`channel ${messageType} cannot create a success for an unconnected provider`, async () => {
      const { service, repository } = fixture();
      await expect(service.sendMessage(901, {
        messageType, targetType: 1, targetIds: [7], content: 'not delivered',
      })).rejects.toThrow(/渠道.*尚未接通/);
      expect(repository.save).not.toHaveBeenCalled();
    });
    it(`channel ${messageType} cannot replay historical placeholder success as delivery`, async () => {
      const { service, repository } = fixture();
      repository.findOne.mockResolvedValue({ id: 42, corpId: 901, sendStatus: 1, content: 'old placeholder' });
      await expect(service.sendMessage(901, {
        messageType, targetType: 1, targetIds: [7], content: 'old placeholder', idempotencyKey: 'historical',
      })).rejects.toThrow(/渠道.*尚未接通/);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
    it(`channel ${messageType} retry remains failed with an explicit reason`, async () => {
      const { service, repository } = fixture();
      const log = { id: 42, corpId: 901, messageType, sendStatus: 2, retryCount: 0 };
      repository.find.mockResolvedValue([log]);
      const result = await service.retryFailedMessages(901, [42]);
      expect(result).toMatchObject({ success: 0, failed: 1 });
      expect(log.sendStatus).toBe(2);
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ failReason: expect.stringMatching(/渠道.*尚未接通/) }));
    });
    it(`channel ${messageType} batch cannot record placeholder success`, async () => {
      const { service, repository } = fixture();
      await expect(service.batchSendMessage(901, {
        messageType, targetType: 1, targetIds: [7], content: 'not delivered',
      })).rejects.toThrow(/渠道.*尚未接通/);
      expect(repository.save).not.toHaveBeenCalled();
    });
  }
  it('explicit Mock5 still creates a synthetic success without provider calls', async () => {
    const { service } = fixture();
    const result = await service.sendMessage(901, {
      messageType: 5, targetType: 1, targetIds: [7], content: 'simulation',
    });
    expect(result).toMatchObject({ success: 1, failed: 0 });
    expect(service.httpService.post).not.toHaveBeenCalled();
  });
  it('requesting Mock5 cannot rebrand an old unsupported-channel idempotent success', async () => {
    const { service, repository } = fixture();
    repository.findOne.mockResolvedValue({ id: 42, corpId: 901, messageType: 1, sendStatus: 1 });
    await expect(service.sendMessage(901, {
      messageType: 5, targetType: 1, targetIds: [7], content: 'simulation', idempotencyKey: 'old-channel',
    })).rejects.toThrow(/渠道.*尚未接通/);
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('template channel capability is checked after tenant-scoped template lookup', async () => {
    const { service, repository } = fixture();
    vi.mocked(service.messageTemplateService.getTemplate).mockResolvedValue({ id: 8, messageType: 1, status: 1, content: 'template' } as never);
    await expect(service.sendByTemplate(901, { templateId: 8, targetType: 1, targetIds: [7] })).rejects.toThrow(/渠道.*尚未接通/);
    expect(service.messageTemplateService.getTemplate).toHaveBeenCalledWith(8, 901);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
