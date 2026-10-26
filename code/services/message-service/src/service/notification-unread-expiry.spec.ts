import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';
type Row = { userId: number; corpId: number; isRead: number; expireTime: number | null };
const now = Date.parse('2026-10-26T00:00:00Z');
function fixture(rows: Row[]) {
  const clauses: string[] = [], params: Record<string, number> = {};
  const matches = (row: Row) => row.userId === params.userId && row.corpId === params.corpId && row.isRead === 0;
  const builder = {
    where: vi.fn((sql: string, values: Record<string, number>) => { clauses.push(sql); Object.assign(params, values); return builder; }),
    andWhere: vi.fn((sql: string, values?: Record<string, number>) => { clauses.push(sql); Object.assign(params, values); return builder; }),
    getCount: vi.fn(async () => rows.filter(row => matches(row) && (!clauses.some(sql => sql.includes('expireTime')) || row.expireTime === null || row.expireTime > now)).length)
  };
  const repository = {
    count: vi.fn(async ({ where }: { where: { userId: number; corpId: number; isRead: number } }) => rows.filter(row => row.userId === where.userId && row.corpId === where.corpId && row.isRead === where.isRead).length),
    createQueryBuilder: vi.fn(() => builder)
  };
  return { service: Object.assign(new NotificationService(), { notificationRepository: repository }), builder, clauses };
}
const row = (expireTime: number | null, patch: Partial<Row> = {}): Row => ({ userId: 7, corpId: 2, isRead: 0, expireTime, ...patch });
describe('unread badge counts only visible unexpired notifications', () => {
  it('excludes expired unread rows while keeping future and no-expiry rows', async () => {
    const t = fixture([row(now - 1), row(now + 1), row(null)]);
    expect(await t.service.getUnreadCount(7, 2)).toBe(2);
  });
  it('expiry equal to database NOW is excluded just like list visibility', async () => {
    const t = fixture([row(now), row(null)]);
    expect(await t.service.getUnreadCount(7, 2)).toBe(1);
  });
  it('keeps user and enterprise filtering and excludes already read rows', async () => {
    const t = fixture([row(null), row(null, { userId: 8 }), row(null, { corpId: 3 }), row(null, { isRead: 1 })]);
    expect(await t.service.getUnreadCount(7, 2)).toBe(1);
  });
  it('zero visible unread stays zero rather than counting expired-only inbox', async () => {
    const t = fixture([row(now - 1)]);
    expect(await t.service.getUnreadCount(7, 2)).toBe(0);
  });
  it('uses database NOW and the exact list expiry predicate', async () => {
    const t = fixture([]); await t.service.getUnreadCount(7, 2);
    expect(t.clauses).toContain('(notification.expireTime IS NULL OR notification.expireTime > NOW())');
  });
});
