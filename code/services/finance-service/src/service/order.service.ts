import { Provide, Inject, Config } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { OrderEntity } from '../entity/order.entity';
import { CreateOrderDto, QueryOrderDto, CancelOrderDto } from '../dto/order.dto';
import dayjs from 'dayjs';

@Provide()
export class OrderService {
  @Inject()
  ctx!: Context;

  @InjectEntityModel(OrderEntity)
  orderRepository!: Repository<OrderEntity>;

  @Config('finance.order')
  orderConfig: any;

  async createOrder(corpId: number, dto: CreateOrderDto, userId?: number): Promise<OrderEntity> {
    // 生成订单号
    const orderNo = this.generateOrderNo();
    
    // 计算实付金额
    const actualAmount = dto.amount - (dto.discountAmount || 0);
    
    // 计算过期时间
    const expireTime = dayjs().add(this.orderConfig.timeout, 'minute').toDate();

    const order = this.orderRepository.create({
      corpId,
      orderNo,
      productName: dto.productName,
      productType: dto.productType,
      amount: dto.amount,
      discountAmount: dto.discountAmount || 0,
      actualAmount,
      status: 1, // 待支付
      expireTime,
      detail: dto.detail,
      remark: dto.remark,
      createUserId: userId,
    });

    return await this.orderRepository.save(order);
  }

  private generateOrderNo(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD${timestamp}${random}`;
  }

  async getOrderById(corpId: number, orderId: number): Promise<OrderEntity | null> {
    return await this.orderRepository.findOne({
      where: { id: orderId, corpId },
    });
  }

  async getOrderByNo(orderNo: string): Promise<OrderEntity | null> {
    return await this.orderRepository.findOne({
      where: { orderNo },
    });
  }

  async queryOrders(corpId: number, query: QueryOrderDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .where('order.corpId = :corpId', { corpId });

    if (query.orderNo) {
      queryBuilder.andWhere('order.orderNo = :orderNo', {
        orderNo: query.orderNo,
      });
    }

    if (query.status !== undefined) {
      queryBuilder.andWhere('order.status = :status', {
        status: query.status,
      });
    }

    if (query.startTime && query.endTime) {
      queryBuilder.andWhere('order.createTime BETWEEN :startTime AND :endTime', {
        startTime: query.startTime,
        endTime: query.endTime,
      });
    }

    queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('order.createTime', 'DESC');

    const [list, total] = await queryBuilder.getManyAndCount();

    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async payOrder(orderId: number): Promise<void> {
    await this.orderRepository.update(
      { id: orderId },
      {
        status: 2, // 已支付
        payTime: new Date(),
      }
    );
  }

  async cancelOrder(corpId: number, orderId: number, dto: CancelOrderDto): Promise<void> {
    const order = await this.getOrderById(corpId, orderId);
    
    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 1) {
      throw new Error('订单状态不允许取消');
    }

    await this.orderRepository.update(
      { id: orderId, corpId },
      {
        status: 3, // 已取消
        cancelTime: new Date(),
        remark: dto.reason || order.remark,
      }
    );
  }
}

