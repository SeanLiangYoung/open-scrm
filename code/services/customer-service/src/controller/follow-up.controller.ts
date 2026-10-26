import { Controller, Post, Get, Body, Param, Query, Inject, httpError } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { FollowUpEntity } from '../entity/follow-up.entity';
import { CustomerEntity } from '../entity/customer.entity';

@Controller('/api/v1/follow-ups')
export class FollowUpController {
  @Inject()
  ctx: Context;

  @InjectEntityModel(CustomerEntity)
  customerRepo: Repository<CustomerEntity>;

  @InjectEntityModel(FollowUpEntity)
  followUpRepo: Repository<FollowUpEntity>;

  @Post('/')
  async create(@Body() body: any) {
    const { corpId, userId } = this.requestIdentity();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new httpError.BadRequestError('请求正文必须为对象');
    }
    const customerId = this.positiveInteger(body.customerId, 'customerId');
    if (typeof body.content !== 'string' || !body.content.trim()) {
      throw new httpError.BadRequestError('content 必须为非空字符串');
    }
    const followType = body.followType === undefined ? 1 : body.followType;
    if (![1, 2, 3, 4].includes(followType)) {
      throw new httpError.BadRequestError('followType 必须为 1、2、3 或 4');
    }
    const nextFollowTime = this.optionalFollowTime(body.nextFollowTime);
    await this.requireCustomer(customerId, corpId);
    const record = this.followUpRepo.create({
      corpId,
      customerId,
      userId,
      followType,
      content: body.content,
      nextFollowTime
    });
    const saved = await this.followUpRepo.save(record);
    return { code: 200, data: saved };
  }

  @Get('/customer/:customerId')
  async listByCustomer(
    @Param('customerId') customerId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20'
  ) {
    const { corpId } = this.requestIdentity();
    const id = this.positiveInteger(customerId, 'customerId');
    const p = this.positiveInteger(page, 'page');
    const ps = this.positiveInteger(pageSize, 'pageSize');
    if (ps > 100) {
      throw new httpError.BadRequestError('pageSize 不能超过 100');
    }
    const skip = (p - 1) * ps;
    if (!Number.isSafeInteger(skip)) {
      throw new httpError.BadRequestError('分页偏移超出安全整数范围');
    }
    await this.requireCustomer(id, corpId);
    const [list, total] = await this.followUpRepo.findAndCount({
      where: { customerId: id, corpId },
      order: { createTime: 'DESC' },
      skip,
      take: ps
    });
    return { code: 200, data: { list, total, page: p, pageSize: ps } };
  }

  private positiveInteger(value: unknown, field: string): number {
    const n = Number(value);
    if (
      !['number', 'string'].includes(typeof value) ||
      !/^[1-9]\d*$/.test(String(value)) ||
      !Number.isSafeInteger(n) ||
      n < 1
    ) {
      throw new httpError.BadRequestError(`${field} 必须为正整数`);
    }
    return n;
  }

  private optionalFollowTime(value: unknown): Date | null {
    if (value === undefined || value === null) return null;
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    ) {
      throw new httpError.BadRequestError('nextFollowTime 必须为 UTC ISO 时间字符串或 null');
    }
    const date = new Date(value);
    const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== canonical) {
      throw new httpError.BadRequestError('nextFollowTime 不是有效时间');
    }
    return date;
  }

  private requestIdentity() {
    const corpHeader = this.ctx.get('x-corp-id');
    const source = corpHeader
      ? { corpId: corpHeader, userId: this.ctx.get('x-user-id') }
      : this.ctx.state?.user;
    if (
      !source ||
      ![source.corpId, source.userId].every(
        (value: unknown) =>
          ['string', 'number'].includes(typeof value) &&
          /^[1-9]\d*$/.test(String(value)) &&
          Number.isSafeInteger(Number(value))
      )
    ) {
      throw new httpError.UnauthorizedError('缺少有效企业与操作者身份，请通过网关访问');
    }
    return { corpId: Number(source.corpId), userId: Number(source.userId) };
  }

  private async requireCustomer(customerId: number, corpId: number): Promise<void> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId, corpId } });
    if (!customer) {
      throw new httpError.NotFoundError('客户不存在');
    }
  }
}
