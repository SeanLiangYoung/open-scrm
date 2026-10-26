import { describe, expect, it, vi } from 'vitest';
import { AuthMiddleware } from './auth.middleware';

function setup(path: string, authorization = '') {
  const middleware = new AuthMiddleware();
  const verify = vi.fn().mockRejectedValue(new Error('expired access token'));
  Object.assign(middleware, { jwtService: { verify } });
  const ctx = {
    path,
    state: {},
    get: (name: string) => (name === 'authorization' ? authorization : '')
  } as any;
  const next = vi.fn(async () => {});
  return { middleware, verify, ctx, next };
}

describe('refresh authentication boundary', () => {
  it.each([
    { userId: 7, type: 'refresh' },
    { userId: 7, corpId: 2, type: 'refresh' },
    { userId: 7, corpId: 2, type: 'password-reset' },
    { userId: 7 },
    { userId: 0, corpId: 2 },
    { userId: 7, corpId: '2junk' },
    { userId: '9007199254740993', corpId: 2 }
  ])('does not authorize a non-access or malformed signed payload %j', async payload => {
    const t = setup('/api/v1/customers', 'Bearer signed-token');
    t.verify.mockResolvedValueOnce(payload);
    await t.middleware.resolve()(t.ctx, t.next);
    expect(t.ctx.status).toBe(401);
    expect(t.next).not.toHaveBeenCalled();
    expect(t.ctx.state.user).toBeUndefined();
  });

  it.each([
    { userId: '7', corpId: '2', isAdmin: 0 },
    { userId: 7, corpId: 2, isAdmin: false, type: 'access' }
  ])('keeps supported access identity claims authorized %j', async payload => {
    const t = setup('/api/v1/customers', 'Bearer access-token');
    t.verify.mockResolvedValueOnce(payload);
    await t.middleware.resolve()(t.ctx, t.next);
    expect(t.next).toHaveBeenCalledTimes(1);
    expect(t.ctx.state.user).toEqual({ ...payload, isAdmin: false });
  });

  it.each(['0', 'false', '1', [], {}, 2, 0, false, undefined].map(isAdmin => ({ isAdmin })))(
    'does not grant admin access for non-admin claim $isAdmin',
    async ({ isAdmin }) => {
      const t = setup('/api/v1/users', 'Bearer signed-access-token');
      t.verify.mockResolvedValueOnce({ userId: 7, corpId: 2, isAdmin });
      await t.middleware.resolve()(t.ctx, t.next);
      expect(t.ctx.status).toBe(403);
      expect(t.next).not.toHaveBeenCalled();
    }
  );
  it.each([1, true])('keeps actual admin claim %j authorized', async isAdmin => {
    const t = setup('/api/v1/users', 'Bearer signed-admin-token');
    t.verify.mockResolvedValueOnce({ userId: 7, corpId: 2, isAdmin });
    await t.middleware.resolve()(t.ctx, t.next);
    expect(t.next).toHaveBeenCalledTimes(1);
    expect(t.ctx.state.user.isAdmin).toBe(true);
  });

  it.each(['', 'Bearer expired-access-token'])(
    'delegates refresh credential validation without requiring access JWT %j',
    async header => {
      const t = setup('/api/v1/auth/refresh-token', header);
      await t.middleware.resolve()(t.ctx, t.next);
      expect(t.next).toHaveBeenCalledTimes(1);
      expect(t.verify).not.toHaveBeenCalled();
    }
  );
  it.each(['/api/v1/auth/verify-token', '/api/v1/users', '/api/v1/auth/refresh-token/extra'])(
    'keeps non-refresh or suffix routes authenticated: %s',
    async path => {
      const t = setup(path);
      await t.middleware.resolve()(t.ctx, t.next);
      expect(t.ctx.status).toBe(401);
      expect(t.next).not.toHaveBeenCalled();
    }
  );
});
