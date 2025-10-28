import { Controller, Post, Get, Put, Query, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { InvoiceService } from '../service/invoice.service';
import { CreateInvoiceDto, QueryInvoiceDto } from '../dto/invoice.dto';

@Controller('/api/invoice')
export class InvoiceController {
  @Inject()
  ctx!: Context;

  @Inject()
  invoiceService!: InvoiceService;

  @Post('/')
  @Validate()
  async createInvoice(@Body() dto: CreateInvoiceDto) {
    const corpId = 1; // TODO: 从JWT获取

    const invoice = await this.invoiceService.createInvoice(corpId, dto);
    return {
      success: true,
      data: invoice,
      message: '发票申请成功',
    };
  }

  @Put('/:id/issue')
  async issueInvoice(@Query('id') id: string) {
    const corpId = 1; // TODO: 从JWT获取

    await this.invoiceService.issueInvoice(corpId, parseInt(id));
    return {
      success: true,
      message: '发票开具成功',
    };
  }

  @Get('/list')
  @Validate()
  async queryInvoices(@Query() query: QueryInvoiceDto) {
    const corpId = 1; // TODO: 从JWT获取

    const result = await this.invoiceService.queryInvoices(corpId, query);
    return {
      success: true,
      data: result,
    };
  }
}

