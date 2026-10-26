import { httpError } from '@midwayjs/core';

/** Preserve exact BIGINT IDs within the service's numeric API. */
export function assetId(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (!['number', 'string'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value))) {
    throw new httpError.BadRequestError('编号必须为规范十进制正整数');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > max) {
    throw new httpError.BadRequestError('编号超出支持范围');
  }
  return id;
}

export function categoryId(value: unknown): number {
  return assetId(value, 2147483647);
}
