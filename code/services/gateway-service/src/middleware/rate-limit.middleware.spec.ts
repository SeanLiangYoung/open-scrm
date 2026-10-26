import { it, expect, vi } from 'vitest';
import { RateLimitMiddleware } from './rate-limit.middleware';
function fixture(current = 1) {
  const redis = { incr: vi.fn().mockResolvedValue(current), expire: vi.fn().mockResolvedValue(1) };
  const middleware = Object.assign(new RateLimitMiddleware(), {
    redisService: redis,
    rateLimitConfig: { max: 100, duration: 60000 }
  });
  const ctx = { ip: '127.0.0.1', path: '/api/v1/assets/71', set: vi.fn() } as any;
  return { redis, middleware, ctx };
}
it.each([404, 500])('propagates downstream %s exactly once', async status => {
  const f = fixture();
  const error = Object.assign(new Error('business error'), { status });
  const next = vi.fn(async () => {
    throw error;
  });
  await expect(f.middleware.resolve()(f.ctx, next)).rejects.toBe(error);
  expect(next).toHaveBeenCalledTimes(1);
});
it('continues once when Redis fails', async () => {
  const f = fixture();
  f.redis.incr.mockRejectedValue(new Error('redis unavailable'));
  const next = vi.fn();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await f.middleware.resolve()(f.ctx, next);
    expect(next).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});
it('retains the actual429 limit without invoking business handler', async () => {
  const f = fixture(101);
  const next = vi.fn();
  await f.middleware.resolve()(f.ctx, next);
  expect(f.ctx.status).toBe(429);
  expect(next).not.toHaveBeenCalled();
});
it('sets limit headers and invokes business once normally', async () => {
  const f = fixture(2);
  const next = vi.fn();
  await f.middleware.resolve()(f.ctx, next);
  expect(next).toHaveBeenCalledTimes(1);
  expect(f.ctx.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '98');
});
