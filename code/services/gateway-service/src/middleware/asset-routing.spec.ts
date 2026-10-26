import { describe, it, expect, vi } from 'vitest';
import config from '../config/config.default';
import { findMatchingGatewayRoute } from '../utils/route-match';
import { ProxyMiddleware } from './proxy.middleware';
import { AuthMiddleware } from './auth.middleware';
const paths = [
  ['/api/v1/assets/71', '/api/asset/71'],
  ['/api/v1/assets/list', '/api/asset/list'],
  ['/api/v1/assets/categories/tree', '/api/asset-category/tree'],
  ['/api/v1/assets/categories', '/api/asset-category'],
  ['/api/asset/71', '/api/asset/71'],
  ['/api/asset-category/tree', '/api/asset-category/tree']
] as const;
describe('asset proxy routing', () => {
  it.each(paths)('maps %s to %s preserving verified tenant', async (path, upstream) => {
    const route = findMatchingGatewayRoute(config.gateway.routes, path);
    expect(route).toBeDefined();
    const request = vi
      .fn()
      .mockResolvedValue({ status: 200, data: { success: true }, headers: {} });
    const proxy = Object.assign(new ProxyMiddleware(), {
      routes: config.gateway.routes,
      httpService: { request }
    });
    const ctx = {
      path,
      method: 'GET',
      query: { id: '99' },
      state: { user: { corpId: 1, userId: 2 } },
      get: (name: string) => ({ 'x-corp-id': '999', 'x-user-id': '999' })[name] || '',
      request: {},
      set: vi.fn()
    };
    await proxy.resolve()(ctx as any, vi.fn());
    expect(request.mock.calls[0][0]).toMatchObject({
      url: route!.target + upstream,
      params: { id: '99' },
      headers: { 'x-corp-id': '1', 'x-user-id': '2' }
    });
  });
  it.each(['/api/v1/assets-evil/71', '/api/asset-evil/71', '/api/asset-category-evil/tree'])(
    'rejects prefix collision %s',
    path => {
      expect(findMatchingGatewayRoute(config.gateway.routes, path)).toBeUndefined();
    }
  );
  it.each(paths)('requires access JWT on %s', async path => {
    const auth = new AuthMiddleware();
    const next = vi.fn();
    const ctx = { path, state: {}, get: () => '' };
    await auth.resolve()(ctx as any, next);
    expect((ctx as any).status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
