import { Controller, Post, Get, Inject, Body } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerEntity } from '../entity/customer.entity';

@Controller('/api/v1/customers')
export class ImportExportController {
  @Inject()
  ctx: Context;

  @InjectEntityModel(CustomerEntity)
  customerRepo: Repository<CustomerEntity>;

  @Get('/export/csv')
  async exportCsv() {
    const corpId = 1;
    const customers = await this.customerRepo.find({ where: { corpId } });

    const header = 'ID,姓名,性别,手机号,渠道,状态,创建时间\n';
    const genderMap: Record<number, string> = { 0: '未知', 1: '男', 2: '女' };
    const statusMap: Record<number, string> = { 0: '已删除', 1: '正常', 2: '流失' };

    const rows = customers.map(c =>
      `${c.id},${c.name || ''},${genderMap[c.gender] || ''},${c.mobile || ''},${c.channel || ''},${statusMap[c.status] || ''},${c.createTime || ''}`
    ).join('\n');

    const bom = '\uFEFF';
    this.ctx.set('Content-Type', 'text/csv; charset=utf-8');
    this.ctx.set('Content-Disposition', 'attachment; filename=customers.csv');
    this.ctx.body = bom + header + rows;
  }

  @Post('/import/csv')
  async importCsv(@Body() body: any) {
    const { rows } = body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return { code: 400, message: '没有导入数据' };
    }

    const channelMap: Record<string, string> = { '抖音': 'douyin', '小红书': 'xiaohongshu', '微信': 'wechat', '线下': 'offline' };
    const genderMap: Record<string, number> = { '男': 1, '女': 2 };

    let imported = 0;
    for (const row of rows) {
      const customer = this.customerRepo.create({
        corpId: 1,
        externalUserid: `import_${Date.now()}_${imported}`,
        name: row.name || row['姓名'] || '',
        gender: genderMap[row.gender || row['性别']] || 0,
        mobile: row.mobile || row['手机号'] || '',
        channel: channelMap[row.channel || row['渠道']] || row.channel || 'other',
        status: 1,
        followUserId: 1,
      });
      await this.customerRepo.save(customer);
      imported++;
    }

    return { code: 200, data: { imported }, message: `成功导入 ${imported} 条客户` };
  }
}
