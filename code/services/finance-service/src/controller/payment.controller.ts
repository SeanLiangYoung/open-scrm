import { Controller, Post, Get, Query, Body, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { Validate } from '@midwayjs/validate';
import { PaymentService } from '../service/payment.service';
import { CreatePaymentDto, PaymentCallbackDto, RefundDto } from '../dto/payment.dto';

@Controller('/api/payment')
export class PaymentController {
  @Inject()
  ctx!: Context;

  @Inject()
  paymentService!: PaymentService;

  @Post('/')
  @Validate()
  async createPayment(@Body() dto: CreatePaymentDto) {
    const payment = await this.paymentService.createPayment(dto);
    return {
      success: true,
      data: payment,
      message: '支付创建成功',
    };
  }

  @Post('/callback')
  @Validate()
  async handleCallback(@Body() dto: PaymentCallbackDto) {
    await this.paymentService.handlePaymentCallback(dto);
    return {
      success: true,
      message: '支付回调处理成功',
    };
  }

  @Post('/refund')
  @Validate()
  async refund(@Body() dto: RefundDto) {
    await this.paymentService.refund(dto);
    return {
      success: true,
      message: '退款成功',
    };
  }

  @Get('/order/:orderId')
  async getPaymentByOrderId(@Query('orderId') orderId: string) {
    const payment = await this.paymentService.getPaymentByOrderId(parseInt(orderId));
    return {
      success: true,
      data: payment,
    };
  }
}

