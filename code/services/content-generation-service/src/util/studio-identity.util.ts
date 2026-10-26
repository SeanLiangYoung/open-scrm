import { httpError } from '@midwayjs/core';
/** Preserve the existing numeric service API without narrowing bigint rows to int4. */
export function requireStudioId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new httpError.BadRequestError('内容编号必须为正安全整数');
  }
  return value;
}
export function parseStudioPathId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new httpError.BadRequestError('内容编号须为规范十进制正整数');
  }
  return requireStudioId(Number(value));
}
function canonicalStoredId(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  return BigInt(value) <= 9223372036854775807n ? value : null;
}
export function sameStudioId(stored: unknown, requested: unknown): boolean {
  const left = canonicalStoredId(stored), right = canonicalStoredId(requested);
  return left !== null && right !== null && left === right;
}
