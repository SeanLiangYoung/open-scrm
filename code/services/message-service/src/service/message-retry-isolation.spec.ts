import { describe, it, expect, vi } from 'vitest';
import { MessageSendService } from './message-send.service';

function fixture() {
  const rows = [
    { id: 11, corpId: 1, messageType: 5, sendStatus: 2, retryCount: 0 },
    { id: 22, corpId: 2, messageType: 5, sendStatus: 2, retryCount: 0 },
    { id: 33, corpId: 1, messageType: 5, sendStatus: 1, retryCount: 0 },
  ];
  const svc = new MessageSendService();
  const find = vi.fn(async ({ where }: any) => rows.filter(r =>
    (where.corpId === undefined || r.corpId === where.corpId) &&
    r.sendStatus === where.sendStatus && where.id._value.includes(r.id)));
  const save = vi.fn(async (row: any) => row);
  svc.messageLogRepository = { find, save } as any;
  svc.messageConfig = { maxRetries: 3 };
  return { svc, rows, find, save };
}
describe('tenant scoped failed message retries', () => {
  it('foreign-only request performs no writes and returns no foreign detail', async () => {
    const { svc, rows, find, save } = fixture();
    expect(await svc.retryFailedMessages(1, [22])).toEqual({ total: 0, success: 0, failed: 0, details: [] });
    expect(find.mock.calls[0][0].where.corpId).toBe(1);
    expect(save).not.toHaveBeenCalled(); expect(rows[1].sendStatus).toBe(2);
  });
  it('mixed and duplicate IDs process own failed row once, never successful/foreign rows', async () => {
    const { svc, rows, find, save } = fixture();
    expect(await svc.retryFailedMessages(1, [11, 22, 11, 33, 999])).toMatchObject({ total: 1, success: 1, failed: 0 });
    expect(find.mock.calls[0][0].where.id._value).toEqual([11, 22, 33, 999]);
    expect(save).toHaveBeenCalledTimes(1); expect(rows[1].sendStatus).toBe(2);
  });
  it('own scalar failed ID remains supported', async () => {
    expect(await fixture().svc.retryFailedMessages(1, 11)).toMatchObject({ success: 1 });
  });
  it.each([undefined, 0, -1, '1', 1.2, Number.MAX_SAFE_INTEGER + 1])('rejects invalid corp %s before repository access', async corp => {
    const { svc, find, save } = fixture();
    await expect(svc.retryFailedMessages(corp as any, 11)).rejects.toThrow();
    expect(find).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it.each([[], [0], [-1], ['11'], [1.5], [Number.MAX_SAFE_INTEGER + 1], Array(101).fill(11), undefined])('rejects invalid/bounded IDs %j before access', async ids => {
    const { svc, find } = fixture();
    await expect(svc.retryFailedMessages(1, ids as any)).rejects.toThrow();
    expect(find).not.toHaveBeenCalled();
  });
});
