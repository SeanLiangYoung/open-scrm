import { httpError } from '@midwayjs/core';
export interface ConsentReadPage { page: number; pageSize: number }
export function parseConsentReadInput(customerId: unknown, query: unknown): { customerId: number; pagination: ConsentReadPage } {
  const invalid = () => { throw new httpError.BadRequestError('授权读取参数无效'); };
  const decimal = (value: unknown, maximum: number): number => {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return invalid();
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number > maximum) return invalid();
    return number;
  };
  const id = decimal(customerId, Number.MAX_SAFE_INTEGER);
  if (!query || typeof query !== 'object' || Array.isArray(query)) return invalid();
  const input = query as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== 'page' && key !== 'pageSize')) return invalid();
  return { customerId: id, pagination: {
    page: input.page === undefined ? 1 : decimal(input.page, 100000),
    pageSize: input.pageSize === undefined ? 20 : decimal(input.pageSize, 100),
  } };
}
