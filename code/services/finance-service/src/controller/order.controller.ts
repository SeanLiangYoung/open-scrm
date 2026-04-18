import { Controller, Post, Get, Put, Query, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { OrderService } from '../service/order.service';
import { CreateOrderDto, QueryOrderDto, CancelOrderDto } from '../dto/order.dto';
import { getTenantContext } from '@scrm/server-common';

@Controller('/api/order')
export class OrderController {
  @Inject()
  ctx!: Context;

  @Inject()
  orderService!: OrderService;

  @Post('/')
  @Validate()
  async createOrder(@Body() dto: CreateOrderDto) {
    const { corpId, userId } = getTenantContext(this.ctx);

    const order = await this.orderService.createOrder(corpId, dto, userId);
    return {
      success: true,
      data: order,
      message: '订单创建成功',
    };
  }

  @Get('/list')
  @Validate()
  async queryOrders(@Query() query: QueryOrderDto) {
    const { corpId } = getTenantContext(this.ctx);

    const result = await this.orderService.queryOrders(corpId, query);
    return {
      success: true,
      data: result,
    };
  }

  @Get('/:id')
  async getOrder(@Query('id') id: string) {
    const { corpId } = getTenantContext(this.ctx);

    const order = await this.orderService.getOrderById(corpId, parseInt(id));
    return {
      success: true,
      data: order,
    };
  }

  @Put('/:id/cancel')
  @Validate()
  async cancelOrder(@Query('id') id: string, @Body() dto: CancelOrderDto) {
    const { corpId } = getTenantContext(this.ctx);

    await this.orderService.cancelOrder(corpId, parseInt(id), dto);
    return {
      success: true,
      message: '订单已取消',
    };
  }
}

