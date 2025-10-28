import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 订单实体
 */
@Entity('order')
@Index(['corpId', 'status'])
@Index(['orderNo'])
@Index(['createTime'])
export class OrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'order_no', type: 'varchar', length: 64, unique: true, comment: '订单号' })
  orderNo: string;

  @Column({ name: 'product_name', type: 'varchar', length: 255, comment: '产品名称' })
  productName: string;

  @Column({ name: 'product_type', type: 'tinyint', comment: '产品类型: 1-套餐 2-增值服务' })
  productType: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '订单金额' })
  amount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0, comment: '优惠金额' })
  discountAmount: number;

  @Column({ name: 'actual_amount', type: 'decimal', precision: 10, scale: 2, comment: '实付金额' })
  actualAmount: number;

  @Column({ type: 'tinyint', default: 1, comment: '状态: 1-待支付 2-已支付 3-已取消 4-已退款' })
  status: number;

  @Column({ name: 'pay_time', type: 'datetime', nullable: true, comment: '支付时间' })
  payTime: Date;

  @Column({ name: 'cancel_time', type: 'datetime', nullable: true, comment: '取消时间' })
  cancelTime: Date;

  @Column({ name: 'expire_time', type: 'datetime', nullable: true, comment: '过期时间' })
  expireTime: Date;

  @Column({ type: 'json', nullable: true, comment: '订单详情' })
  detail: any;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @Column({ name: 'create_user_id', type: 'bigint', unsigned: true, nullable: true, comment: '创建人ID' })
  createUserId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

