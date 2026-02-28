import { Controller, Post, Get, Body, Param, Query, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { FollowUpEntity } from '../entity/follow-up.entity';

@Controller('/api/v1/follow-ups')
export class FollowUpController {
  @InjectEntityModel(FollowUpEntity)
  followUpRepo: Repository<FollowUpEntity>;

  @Post('/')
  async create(@Body() body: any) {
    const record = this.followUpRepo.create({
      corpId: body.corpId || 1,
      customerId: body.customerId,
      userId: body.userId || 1,
      followType: body.followType || 1,
      content: body.content,
      nextFollowTime: body.nextFollowTime || null,
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
    const p = Number(page);
    const ps = Number(pageSize);
    const [list, total] = await this.followUpRepo.findAndCount({
      where: { customerId: Number(customerId) },
      order: { createTime: 'DESC' },
      skip: (p - 1) * ps,
      take: ps,
    });
    return { code: 200, data: { list, total, page: p, pageSize: ps } };
  }
}
