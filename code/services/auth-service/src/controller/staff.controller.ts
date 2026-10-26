import { Controller, Get, Inject, Query, httpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { UserEntity } from '../entity/user.entity';

/** Read-only employee choices; the platform-admin user API is separate. */
@Controller('/api/v1/staff')
export class StaffController {
  @Inject()
  ctx: Context;

  @InjectEntityModel(UserEntity)
  staffRepository: Repository<UserEntity>;

  @Get('/')
  async list(@Query() query: Record<string, unknown> = {}) {
    const corpId = this.requestCorpId();
    if (
      !query ||
      typeof query !== 'object' ||
      Array.isArray(query) ||
      Object.keys(query).some(key => !['page', 'pageSize', 'keyword'].includes(key))
    ) {
      throw new httpError.BadRequestError('员工查询参数无效');
    }
    const page = this.positiveInteger(query.page ?? 1, 'page');
    const pageSize = this.positiveInteger(query.pageSize ?? 20, 'pageSize');
    const skip = (page - 1) * pageSize;
    if (pageSize > 100 || !Number.isSafeInteger(skip)) {
      throw new httpError.BadRequestError('员工查询分页超出范围');
    }
    if (
      query.keyword !== undefined &&
      (typeof query.keyword !== 'string' || query.keyword.length > 50)
    ) {
      throw new httpError.BadRequestError('keyword 必须为不超过50字符的字符串');
    }
    const keyword = typeof query.keyword === 'string' ? query.keyword.trim() : '';
    const scoped = { corpId, status: 1 };
    // Literal substring search: escape SQL LIKE metacharacters; TypeORM binds it.
    const pattern = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
    const where = keyword
      ? [
          { ...scoped, username: ILike(pattern) },
          { ...scoped, realName: ILike(pattern) }
        ]
      : scoped;
    const [rows, total] = await this.staffRepository.findAndCount({
      where,
      select: { id: true, username: true, realName: true },
      order: { username: 'ASC', id: 'ASC' },
      skip,
      take: pageSize
    });
    return {
      success: true,
      data: {
        list: rows.map(row => ({
          id: String(row.id),
          username: row.username,
          realName: row.realName ?? null
        })),
        total,
        page,
        pageSize
      }
    };
  }

  private positiveInteger(value: unknown, field: string): number {
    if (
      !['number', 'string'].includes(typeof value) ||
      !/^[1-9]\d*$/.test(String(value)) ||
      !Number.isSafeInteger(Number(value))
    ) {
      throw new httpError.BadRequestError(`${field} 必须为安全的十进制正整数`);
    }
    return Number(value);
  }

  private requestCorpId(): number {
    const header = this.ctx.get('x-corp-id');
    const identity = header
      ? { corpId: header, userId: this.ctx.get('x-user-id') }
      : this.ctx.state?.user;
    if (
      !identity ||
      ![identity.corpId, identity.userId].every(
        value =>
          ['number', 'string'].includes(typeof value) &&
          /^[1-9]\d*$/.test(String(value)) &&
          Number.isSafeInteger(Number(value))
      )
    ) {
      throw new httpError.UnauthorizedError('缺少有效企业与操作者身份，请通过网关访问');
    }
    return Number(identity.corpId);
  }
}
