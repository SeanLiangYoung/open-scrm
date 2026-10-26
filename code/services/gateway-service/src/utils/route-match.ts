/**
 * Pure gateway route matching (used by ProxyMiddleware and unit tests).
 */
export interface GatewayRouteConfig {
  path: string;
  target: string;
  /** Replace only the configured path prefix; omitted routes preserve their path. */
  upstreamPrefix?: string;
}

export function findMatchingGatewayRoute(
  routes: GatewayRouteConfig[],
  requestPath: string
): GatewayRouteConfig | undefined {
  return routes.find(route => {
    const routePath = route.path.replace('/*', '');
    return requestPath === routePath || requestPath.startsWith(`${routePath}/`);
  });
}

export function gatewayUpstreamPath(route: GatewayRouteConfig, requestPath: string): string {
  if (route.upstreamPrefix === undefined) return requestPath;
  const prefix = route.path.replace(/\/\*$/, '');
  return `${route.upstreamPrefix}${requestPath.slice(prefix.length)}`;
}
