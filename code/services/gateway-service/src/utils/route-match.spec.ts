import { describe, expect, it } from 'vitest';
import { findMatchingGatewayRoute } from './route-match';

describe('findMatchingGatewayRoute', () => {
  const routes = [
    { path: '/api/v1/auth/*', target: 'http://localhost:7001' },
    { path: '/api/v1/customers/*', target: 'http://localhost:7002' },
    { path: '/api/v1/tags', target: 'http://localhost:7002' },
  ];

  it('matches prefix routes with wildcard', () => {
    expect(
      findMatchingGatewayRoute(routes, '/api/v1/auth/login')?.target
    ).toBe('http://localhost:7001');
  });

  it('matches exact tag path', () => {
    expect(
      findMatchingGatewayRoute(routes, '/api/v1/tags')?.target
    ).toBe('http://localhost:7002');
  });

  it('returns undefined when no route matches', () => {
    expect(findMatchingGatewayRoute(routes, '/unknown')).toBeUndefined();
  });
});
