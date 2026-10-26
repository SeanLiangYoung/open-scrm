import { httpError } from '@midwayjs/core';

/** User IDs remain BIGINT-compatible up to the exact JS safe integer boundary. */
export function adminUserId(value: unknown): number {
  if (
    !['number', 'string'].includes(typeof value) ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new httpError.BadRequestError('用户编号必须为规范十进制正安全整数');
  return Number(value);
}
export function adminNewPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8)
    throw new httpError.BadRequestError('新密码至少8位');
  return value;
}
export function adminRoleIds(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.some(
      id => typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > 2_147_483_647
    )
  ) {
    throw new httpError.BadRequestError('角色编号须为JSON正整数INT32数组');
  }
  return [...new Set(value)];
}
