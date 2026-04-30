import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { MessageSendService } from './message-send.service';
import type { MessageLogEntity } from '../entity/message-log.entity';
import type { Repository } from 'typeorm';

/** 无 DB：仅测幂等与分支（TDD 补充 sendMessage 行为契约） */
function makeService(repo: Partial<Repository<MessageLogEntity>>) {
  const svc = new MessageSendService();
  (svc as unknown as { messageLogRepository: Partial<Repository<MessageLogEntity>> }).messageLogRepository =
    repo as Repository<MessageLogEntity>;
  (svc as unknown as { messageTemplateService: object }).messageTemplateService = {};
  (svc as unknown as { httpService: object }).httpService = {};
  (svc as unknown as { messageConfig: object }).messageConfig = {
    batchSize: 100,
    batchInterval: 0,
    maxRetries: 3,
  };
  return svc;
}

describe('MessageSendService.sendMessage 幂等', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('有幂等键且库中已有成功记录时直接重放且不 save 新日志', async () => {
    const findOne = vi.fn().mockResolvedValue({
      id: 42,
      corpId: 1,
      sendStatus: 1,
      content: 'hello',
      failReason: null,
      externalId: null,
      idempotencyKey: 'k1',
    });
    const save = vi.fn();
    const create = vi.fn((x: object) => x);
    const svc = makeService({ findOne, create, save });

    const result = await svc.sendMessage(1, {
      messageType: 2,
      targetType: 1,
      targetIds: [99],
      content: 'x',
      idempotencyKey: 'k1',
    });

    expect(result).toMatchObject({
      idempotentReplay: true,
      messageLogId: 42,
      sendStatus: 1,
      content: 'hello',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('幂等键 + 多个 targetIds 时拒绝', async () => {
    const svc = makeService({
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn((x: object) => x),
    });
    await expect(
      svc.sendMessage(1, {
        messageType: 2,
        targetType: 1,
        targetIds: [1, 2],
        content: 'x',
        idempotencyKey: 'k',
      })
    ).rejects.toThrow(/targetIds/);
  });

  it('并发插入唯一冲突后重放已存在行', async () => {
    const existingRow = {
      id: 7,
      corpId: 1,
      sendStatus: 1,
      content: 'done',
      failReason: null,
      externalId: null,
      idempotencyKey: 'race',
    };
    const qe = new QueryFailedError('INSERT', [], {
      code: '23505',
      constraint: 'ux_message_log_corp_idempotency',
    } as never);
    const findOne = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingRow);
    const save = vi.fn().mockRejectedValueOnce(qe);
    const create = vi.fn((x: object) => ({ ...x, id: 999 }));

    const svc = makeService({ findOne, create, save });

    const result = await svc.sendMessage(1, {
      messageType: 2,
      targetType: 1,
      targetIds: [5],
      content: 'c',
      idempotencyKey: 'race',
    });

    expect(result).toMatchObject({
      success: 1,
      details: [{ idempotentReplay: true, messageLogId: 7 }],
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('messageType 5（Outbound Mock）无外呼且发送成功', async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const save = vi
      .fn()
      .mockImplementationOnce(async (entity: object) => ({ ...entity, id: 200 }))
      .mockImplementation(async (entity: object) => entity);
    const create = vi.fn((x: object) => x);
    const svc = makeService({ findOne, create, save });

    const result = await svc.sendMessage(1, {
      messageType: 5,
      targetType: 1,
      targetIds: [1],
      content: 'mock outbound',
    });

    expect(result.success).toBe(1);
    expect(result.details?.[0]?.success).toBe(true);
    expect(save).toHaveBeenCalled();
  });
});
