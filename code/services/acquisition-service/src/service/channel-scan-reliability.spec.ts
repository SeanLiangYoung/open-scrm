import { describe, expect, it, vi } from 'vitest';
import { ChannelCodeService } from './channel-code.service';
import { AcquisitionApiController } from '../controller/acquisition-api.controller';
import { ChannelCodeEntity } from '../entity/channel-code.entity';

function fixture() {
  let count = 0, ledger = new Map<string, number>(), failSave = false, queue = Promise.resolve();
  const touches: unknown[] = [], locks: unknown[] = [];
  const code = { findOne: vi.fn(async (options: { where: { corpId: number; id: number }; lock?: unknown }) => {
    locks.push(options.lock);
    return options.where.corpId === 2 && options.where.id === 1 ? { id: 1, corpId: 2, scanCount: count } : null;
  }), save: vi.fn(async (row: { scanCount: number }) => { if (failSave) { failSave = false; throw new Error('database failed'); } count = row.scanCount; return row; }) };
  const events = { findOne: vi.fn(async (options: { where: { externalEventId: string } }) => {
    const expiry = ledger.get(options.where.externalEventId);
    return expiry ? { expiresAt: new Date(expiry) } : null;
  }), create: (row: unknown) => row, save: vi.fn(async (row: { externalEventId: string; expiresAt: Date }) => { ledger.set(row.externalEventId, row.expiresAt.getTime()); return row; }), delete: vi.fn() };
  const manager = { getRepository: (entity: { name: string }) => entity === ChannelCodeEntity ? code : entity.name === 'ChannelScanEventEntity' ? events : { create: (row: unknown) => row, save: async (row: unknown) => { touches.push(row); return row; } }, query: vi.fn(async () => [{ now: new Date() }]) };
  const transaction = vi.fn(async (callback: (manager: unknown) => Promise<unknown>) => {
    const previous = queue; let release!: () => void; queue = new Promise(resolve => { release = resolve; }); await previous;
    const before = count, oldLedger = new Map(ledger), oldTouches = touches.length;
    try { return await callback(manager); } catch (error) { count = before; ledger = oldLedger; touches.length = oldTouches; throw error; } finally { release(); }
  });
  const cleanup = vi.fn(async () => []);
  const service = Object.assign(new ChannelCodeService(), { codeRepository: { ...code, manager: { transaction, query: cleanup } }, scanTouchRepository: { create: (row: unknown) => row, save: async (row: unknown) => { touches.push(row); return row; } }, redisService: { get: async (key: string) => ledger.get(key), set: async (key: string) => ledger.set(key, Date.now() + 86400000) } });
  const controller = Object.assign(new AcquisitionApiController(), { channelCodeService: service, ctx: { get: (key: string) => ({ 'x-corp-id': '2', 'x-user-id': '7' }[key] || '') } });
  return { service, controller, events, locks, transaction, cleanup, count: () => count, touches, failNextSave: () => { failSave = true; }, expire: () => { ledger.set('same', Date.now() - 1); } };
}

describe('transactional channel scan ingestion', () => {
  it('retries the same event after failed save instead of losing it', async () => { const f = fixture(); f.failNextSave(); await expect(f.service.recordScanEvent(2, 1, { externalEventId: 'same' })).rejects.toThrow('database failed'); expect(await f.service.recordScanEvent(2, 1, { externalEventId: 'same' })).toEqual({ scanCount: 1, replayed: false }); expect(f.count()).toBe(1); });
  it('counts distinct concurrent events without losing an increment', async () => { const f = fixture(); await Promise.all(['a', 'b'].map(externalEventId => f.service.recordScanEvent(2, 1, { externalEventId }))); expect(f.count()).toBe(2); expect(f.transaction).toHaveBeenCalledTimes(2); expect(f.locks).toEqual([{ mode: 'pessimistic_write' }, { mode: 'pessimistic_write' }]); });
  it('counts a concurrent duplicate once and returns latest count', async () => { const f = fixture(); const results = await Promise.all([1, 2].map(() => f.service.recordScanEvent(2, 1, { externalEventId: 'same' }))); expect(results).toEqual([{ scanCount: 1, replayed: false }, { scanCount: 1, replayed: true }]); });
  it('locks an expired receipt through renewal so maintenance cannot delete its save target', async () => { const f = fixture(); f.expire(); await f.service.recordScanEvent(2, 1, { externalEventId: 'same' }); expect(f.events.findOne).toHaveBeenCalledWith({ where: { corpId: 2, channelCodeId: 1, externalEventId: 'same' }, lock: { mode: 'pessimistic_write' } }); });
  it('accepts an expired event again after 24 hours', async () => { const f = fixture(); f.expire(); expect(await f.service.recordScanEvent(2, 1, { externalEventId: 'same' })).toEqual({ scanCount: 1, replayed: false }); });
  it('does not touch foreign or missing channel codes', async () => { const f = fixture(); await expect(f.service.recordScanEvent(1, 1, { externalEventId: 'same' })).rejects.toThrow(); expect(f.count()).toBe(0); expect(f.events.save).not.toHaveBeenCalled(); });
  it('runs maintenance only after the successful business transaction completes', async () => { const f = fixture(); f.cleanup.mockImplementation(async () => { expect(f.count()).toBe(1); return []; }); await f.service.recordScanEvent(2, 1, {}); expect(f.cleanup).toHaveBeenCalledTimes(1); });
  it('does not turn committed success into failure when cleanup is unavailable', async () => { const f = fixture(); const log = vi.spyOn(console, 'error').mockImplementation(() => {}); f.cleanup.mockRejectedValueOnce(new Error('maintenance unavailable')); try { expect(await f.service.recordScanEvent(2, 1, {})).toEqual({ scanCount: 1, replayed: false }); expect(f.count()).toBe(1); expect(log).toHaveBeenCalledTimes(1); } finally { log.mockRestore(); } });
  it('does not add an attribution placeholder for event-only scans', async () => { const f = fixture(); await f.service.recordScanEvent(2, 1, { externalEventId: 'same' }); expect(f.touches).toHaveLength(0); });
});

describe('strict acquisition channel path IDs', () => {
  for (const id of ['1junk', '1.5', '01', '0', '-1', '1e0', '2147483648', '9007199254740993']) {
    for (const method of ['ingestScan', 'getOne', 'latestScanTouch'] as const) {
      it(`${method} rejects ${id} before any repository access`, async () => { const f = fixture(); await expect(f.controller[method](id, {})).rejects.toMatchObject({ status: 400 }); expect(f.locks).toHaveLength(0); });
    }
  }
  it('continues to accept canonical valid IDs', async () => { const f = fixture(); expect((await f.controller.ingestScan('1', {})).success).toBe(true); expect(f.count()).toBe(1); });
});
