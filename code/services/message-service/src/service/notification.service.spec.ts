import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';
import { NotificationEntity } from '../entity/notification.entity';
function setup(users: Array<{ id: number; corpId: number; status: number }> = [{ id: 7, corpId: 2, status: 1 }, { id: 8, corpId: 2, status: 1 }]) {
  const rows: any[] = [];
  const repo = {
    create: vi.fn((input: any) => ({ ...input })),
    save: vi.fn(async (items: any[]) => { rows.push(...items); return items; }),
    manager: {} as any,
  };
  const query = vi.fn(async (_sql: string, [corpId, ids]: [number, number[]]) => users.filter(user => user.corpId === corpId && user.status === 1 && ids.includes(user.id)).map(user => ({ id: String(user.id) })));
  const transaction = vi.fn(async (work: any) => {
    const count = rows.length;
    try { return await work({ query, getRepository: (entity: unknown) => { expect(entity).toBe(NotificationEntity); return repo; } }); }
    catch (error) { rows.splice(count); throw error; }
  });
  repo.manager.transaction = transaction;
  const service = Object.assign(new NotificationService(), { notificationRepository: repo, notificationConfig: { defaultExpireDays: 30 } });
  return { service, repo, query, transaction, rows };
}
const body = (userIds: number | number[]) => ({ userIds, notificationType: 1, title: '待办', content: '请跟进', linkUrl: '/customers/10', extra: { source: 'SOP' }, expireDays: 2 });
describe('NotificationService employee tenant boundary', () => {
  it('deduplicates enabled same-company recipients and preserves optional fields and result', async () => {
    const t = setup();
    expect(await t.service.createNotification(2, body([7, 8, 7]))).toEqual({ success: true, count: 2 });
    expect(t.rows.map(row => row.userId)).toEqual([7, 8]);
    expect(t.rows[0]).toMatchObject({ corpId: 2, title: '待办', content: '请跟进', linkUrl: '/customers/10', extra: { source: 'SOP' } });
    expect(t.rows[0].expireTime).toBeInstanceOf(Date);
    expect(t.query).toHaveBeenCalledWith(expect.stringContaining('FOR SHARE'), [2, [7, 8]]);
    expect(t.transaction).toHaveBeenCalledTimes(1);
  });
  it('keeps the scalar recipient contract', async () => {
    const t = setup();
    expect(await t.service.createNotification(2, body(7))).toEqual({ success: true, count: 1 });
  });
  it.each([
    { name: 'foreign', user: { id: 8, corpId: 3, status: 1 } },
    { name: 'disabled', user: { id: 8, corpId: 2, status: 0 } },
    { name: 'missing', user: { id: 9, corpId: 2, status: 1 } },
  ])('rejects the entire mixed batch with a $name employee before any creation/save', async ({ user }) => {
    const t = setup([{ id: 7, corpId: 2, status: 1 }, user]);
    await expect(t.service.createNotification(2, body([7, 8]))).rejects.toMatchObject({ status: 400 });
    expect(t.repo.create).not.toHaveBeenCalled();
    expect(t.repo.save).not.toHaveBeenCalled();
    expect(t.rows).toEqual([]);
  });
  it.each([[], [0], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1], [NaN], [Infinity], ['7'], [null], [7, '8']].map(ids => ({ ids })))('rejects invalid recipient IDs $ids before database work', async ({ ids }) => {
    const t = setup();
    await expect(t.service.createNotification(2, body(ids as number[]))).rejects.toMatchObject({ status: 400 });
    expect(t.transaction).not.toHaveBeenCalled();
    expect(t.repo.save).not.toHaveBeenCalled();
  });
  it('does not leave partial notifications if batch save fails', async () => {
    const t = setup();
    t.repo.save.mockImplementationOnce(async items => { t.rows.push(items[0]); throw new Error('save failed'); });
    await expect(t.service.createNotification(2, body([7, 8]))).rejects.toThrow('save failed');
    expect(t.rows).toEqual([]);
  });
  it.each([0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1])('rejects invalid trusted company %s', async corpId => {
    const t = setup();
    await expect(t.service.createNotification(corpId, body(7))).rejects.toMatchObject({ status: 400 });
    expect(t.repo.save).not.toHaveBeenCalled();
  });
});
