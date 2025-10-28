import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 支付记录实体
 */
@Entity('payment')
@Index(['orderId'])
@Index(['transactionId'])
@Index(['createTime'])
export class PaymentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'order_id', type: 'bigint', unsigned: true, comment: '订单ID' })
  orderId: number;

  @Column({ name: 'order_no', type: 'varchar', length: 64, comment: '订单号' })
  orderNo: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 20, comment: '支付方式: wechat/alipay' })
  paymentMethod: string;

  @Column({ name: 'transaction_id', type: 'varchar', length: 64, nullable: true, comment: '第三方交易号' })
  transactionId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '支付金额' })
  amount: number;

  @Column({ type: 'tinyint', default: 1, comment: '状态: 1-待支付 2-支付成功 3-支付失败 4-已退款' })
  status: number;

  @Column({ name: 'pay_time', type: 'datetime', nullable: true, comment: '支付时间' })
  payTime: Date;

  @Column({ name: 'refund_time', type: 'datetime', nullable: true, comment: '退款时间' })
  refundTime: Date;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '退款金额' })
  refundAmount: number;

  @Column({ type: 'json', nullable: true, comment: '支付详情' })
  detail: any;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

