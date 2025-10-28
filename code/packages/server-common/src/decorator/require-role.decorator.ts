/**
 * 角色权限装饰器
 */

/**
 * 要求特定角色
 * @param roles 角色数组
 */
export function RequireRole(roles: string | string[]) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const ctx = args[0]; // 假设第一个参数是Context
      const userRoles = ctx?.state?.user?.roles || [];
      const requiredRoles = Array.isArray(roles) ? roles : [roles];

      const hasRole = requiredRoles.some((role: string) =>
        userRoles.includes(role)
      );

      if (!hasRole) {
        throw new Error(`权限不足，需要角色: ${requiredRoles.join(', ')}`);
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

