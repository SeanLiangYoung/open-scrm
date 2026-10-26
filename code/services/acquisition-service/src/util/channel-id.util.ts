import { httpError } from '@midwayjs/core';

/** channel_code.id is PostgreSQL INTEGER; never truncate or round a path ID. */
export function channelId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) {
    throw new httpError.BadRequestError('活码编号须为有效的十进制正整数');
  }
  return Number(value);
}
