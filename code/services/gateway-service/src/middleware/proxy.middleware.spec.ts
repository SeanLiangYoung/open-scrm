import { describe, expect, it, vi } from 'vitest';
import { ProxyMiddleware } from './proxy.middleware';

describe('ProxyMiddleware trusted headers', () => {
  function setup(user?: { corpId: number; userId: number }) {
    const middleware = new ProxyMiddleware();
    middleware.routes = [{ path: '/api/v1/messages/*', target: 'http://message.internal' }];
    const request = vi.fn().mockResolvedValue({ status: 200, data: { code: 200 }, headers: {} });
    middleware.httpService = { request } as any;
    const incoming: Record<string, string> = {
      authorization: 'Bearer verified-token',
      'content-type': 'application/json',
      'idempotency-key': 'campaign-customer-42',
      'x-corp-id': '999',
      'x-user-id': '999'
    };
    const ctx = {
      path: '/api/v1/messages/send',
      method: 'POST',
      query: {},
      request: { body: { customerId: 42, messageType: 2 } },
      state: { user },
      get: (name: string) => incoming[name] || '',
      set: vi.fn()
    } as any;
    return { middleware, request, ctx };
  }

  it('preserves Idempotency-Key for retries through the gateway', async () => {
    const { middleware, request, ctx } = setup({ corpId: 7, userId: 8 });
    await middleware.resolve()(ctx, vi.fn());
    expect(request.mock.calls[0][0].headers['idempotency-key']).toBe('campaign-customer-42');
  });

  it('replaces forged tenant headers with the authenticated identity', async () => {
    const { middleware, request, ctx } = setup({ corpId: 7, userId: 8 });
    await middleware.resolve()(ctx, vi.fn());
    expect(request.mock.calls[0][0].headers).toMatchObject({
      'x-corp-id': '7',
      'x-user-id': '8'
    });
  });

  it('does not forward incoming tenant identity without authenticated state', async () => {
    const { middleware, request, ctx } = setup();
    await middleware.resolve()(ctx, vi.fn());
    expect(request.mock.calls[0][0].headers).not.toHaveProperty('x-corp-id');
    expect(request.mock.calls[0][0].headers).not.toHaveProperty('x-user-id');
  });
});
