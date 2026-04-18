/**
 * Pure gateway route matching (used by ProxyMiddleware and unit tests).
 */
export interface GatewayRouteConfig {
  path: string;
  target: string;
}

export function findMatchingGatewayRoute(
  routes: GatewayRouteConfig[],
  requestPath: string
): GatewayRouteConfig | undefined {
  return routes.find(route => {
    const routePath = route.path.replace('/*', '');
    return requestPath.startsWith(routePath);
  });
}
