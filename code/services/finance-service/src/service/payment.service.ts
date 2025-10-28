import { Provide, Inject } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { PaymentEntity } from '../entity/payment.entity';
import { OrderService } from './order.service';
import { CreatePaymentDto, PaymentCallbackDto, RefundDto } from '../dto/payment.dto';

@Provide()
export class PaymentService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(PaymentEntity)
  paymentRepository!: Repository<PaymentEntity>;

  @Inject()
  orderService!: OrderService;

  async createPayment(dto: CreatePaymentDto): Promise<PaymentEntity> {
    const order = await this.orderService.getOrderById(1, dto.orderId); // TODO: 获取真实corpId
    
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 1) {
      throw new Error('订单状态不允许支付');
    }

    const payment = this.paymentRepository.create({
      orderId: dto.orderId,
      orderNo: order.orderNo,
      paymentMethod: dto.paymentMethod,
      amount: order.actualAmount,
      status: 1, // 待支付
    });

    return await this.paymentRepository.save(payment);
  }

  async handlePaymentCallback(dto: PaymentCallbackDto): Promise<void> {
    const order = await this.orderService.getOrderByNo(dto.orderNo);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    // 更新支付记录
    await this.paymentRepository.update(
      { orderNo: dto.orderNo },
      {
        transactionId: dto.transactionId,
        status: 2, // 支付成功
        payTime: new Date(),
        detail: dto.detail,
      }
    );

    // 更新订单状态
    await this.orderService.payOrder(order.id);
  }

  async refund(dto: RefundDto): Promise<void> {
    const order = await this.orderService.getOrderById(1, dto.orderId); // TODO: 获取真实corpId
    
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 2) {
      throw new Error('订单未支付，无法退款');
    }

    // 更新支付记录
    await this.paymentRepository.update(
      { orderId: dto.orderId },
      {
        status: 4, // 已退款
        refundTime: new Date(),
        refundAmount: dto.refundAmount,
      }
    );

    // 更新订单状态
    await this.orderService.cancelOrder(order.corpId, dto.orderId, {
      reason: dto.reason,
    });
  }

  async getPaymentByOrderId(orderId: number): Promise<PaymentEntity | null> {
    return await this.paymentRepository.findOne({
      where: { orderId },
      order: { createTime: 'DESC' },
    });
  }
}

