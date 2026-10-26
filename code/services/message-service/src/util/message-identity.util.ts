import { httpError } from '@midwayjs/core';
/** The existing detail/write contract accepts only exactly representable numeric IDs. */
export function requireMessageNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new httpError.BadRequestError('消息编号须为正安全整数');
  }
  return value;
}
export function parseMessagePathId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new httpError.BadRequestError('消息编号格式无效');
  }
  return requireMessageNumber(Number(value));
}

/** message_template uses PostgreSQL SERIAL/int4, independently of bigint logs. */
export const MAX_MESSAGE_TEMPLATE_ID = 2147483647;
export function requireTemplateNumber(value: unknown): number {
  const id = requireMessageNumber(value);
  if (id > MAX_MESSAGE_TEMPLATE_ID) throw new httpError.BadRequestError('模板编号超出支持范围');
  return id;
}
export function parseTemplatePathId(value: unknown): number {
  return requireTemplateNumber(parseMessagePathId(value));
}
