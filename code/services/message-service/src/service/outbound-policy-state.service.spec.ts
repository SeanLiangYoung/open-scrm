import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboundPolicyStateService } from './outbound-policy-state.service';
import { getRegionPackById } from '../catalog/region-packs';

function makeService(redis: { get: ReturnType<typeof vi.fn>; incr: ReturnType<typeof vi.fn>; decr: ReturnType<typeof vi.fn>; expire: ReturnType<typeof vi.fn> }) {
  const svc = new OutboundPolicyStateService();
  (svc as unknown as { redisService: typeof redis }).redisService = redis;
  return svc;
}

describe('OutboundPolicyStateService.tryConsumeMarketingSendSlot', () => {
  const th = getRegionPackById('th-bangkok')!;
  const de = getRegionPackById('de-berlin')!;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('静默窗内直接拒绝且不访问 Redis', async () => {
    const redis = {
      get: vi.fn(),
      incr: vi.fn(),
      decr: vi.fn(),
      expire: vi.fn(),
    };
    const svc = makeService(redis);
    const r = await svc.tryConsumeMarketingSendSlot({
      corpId: 1,
      pack: th,
      targetType: 1,
      targetId: 99,
      now: new Date('2026-06-15T15:30:00.000Z'),
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe('silent_hours');
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('GET 计数已达上限时拒绝且不 INCR', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue(String(de.maxMarketingSendsPerRecipientPerDay)),
      incr: vi.fn(),
      decr: vi.fn(),
      expire: vi.fn(),
    };
    const svc = makeService(redis);
    const r = await svc.tryConsumeMarketingSendSlot({
      corpId: 1,
      pack: de,
      targetType: 1,
      targetId: 1,
      now: new Date('2026-06-15T08:00:00.000Z'),
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe('frequency_cap');
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('首次发送 INCR=1 且设置 TTL', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue(null),
      incr: vi.fn().mockResolvedValue(1),
      decr: vi.fn(),
      expire: vi.fn().mockResolvedValue('OK'),
    };
    const svc = makeService(redis);
    const r = await svc.tryConsumeMarketingSendSlot({
      corpId: 1,
      pack: de,
      targetType: 1,
      targetId: 2,
      now: new Date('2026-06-15T08:00:00.000Z'),
    });
    expect(r.allowed).toBe(true);
    expect(redis.incr).toHaveBeenCalledTimes(1);
    expect(redis.expire).toHaveBeenCalled();
  });

  it('INCR 后发现超上限则 DECR 并拒绝', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue('2'),
      incr: vi.fn().mockResolvedValue(4),
      decr: vi.fn().mockResolvedValue(3),
      expire: vi.fn(),
    };
    const svc = makeService(redis);
    const r = await svc.tryConsumeMarketingSendSlot({
      corpId: 1,
      pack: de,
      targetType: 1,
      targetId: 3,
      now: new Date('2026-06-15T08:00:00.000Z'),
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe('frequency_cap');
    expect(redis.decr).toHaveBeenCalled();
  });
});
