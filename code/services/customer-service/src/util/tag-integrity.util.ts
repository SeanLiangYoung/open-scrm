import { httpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { getSchema } from '@midwayjs/validate';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
export const MAX_TAG_ID = 2147483647; // PostgreSQL customer_tag.id/parent_id INTEGER.
export function positiveId(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (!['number', 'string'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) ||
      !Number.isSafeInteger(Number(value)) || Number(value) > max) throw new httpError.BadRequestError('编号必须为支持范围内的规范十进制正整数');
  return Number(value);
}
export const tagId = (value: unknown): number => positiveId(value, MAX_TAG_ID);
export function tagTenant(ctx: Context) {
  const corp = ctx.get('x-corp-id'), user = ctx.get('x-user-id');
  const hasHeaders = !!corp || !!user || ['x-corp-id','x-user-id'].some(key => Object.prototype.hasOwnProperty.call(ctx.headers || {}, key));
  const identity = hasHeaders ? { corpId: corp, userId: user } : ctx.state?.user;
  try { if (!identity) throw new Error(); return { corpId: positiveId(identity.corpId), userId: positiveId(identity.userId) }; }
  catch { throw new httpError.UnauthorizedError('缺少有效企业与操作者身份，请通过网关访问'); }
}
export function tagIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100 || value.some(id => typeof id !== 'number')) throw new httpError.BadRequestError('tagIds须为1至100个数值标签编号');
  return [...new Set(value.map(tagId))];
}
export function tagInput(value: unknown, create: boolean): UpdateTagDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new httpError.BadRequestError('标签参数无效');
  const schema = getSchema(create ? CreateTagDto : UpdateTagDto);
  const result = schema.validate(value, { convert: false, allowUnknown: false });
  if (result.error) throw new httpError.BadRequestError('标签参数无效：' + result.error.message);
  const input = result.value as UpdateTagDto;
  const output: UpdateTagDto = {};
  for (const key of ['tagName','tagType','tagColor','parentId','sort','isAuto'] as const) {
    if (input[key] !== undefined) Object.assign(output, { [key]: input[key] });
  }
  if (typeof output.tagName === 'string') {
    output.tagName = output.tagName.trim();
    if (!output.tagName) throw new httpError.BadRequestError('标签名不能为空');
  }
  return output;
}
