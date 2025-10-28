import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 发票实体
 */
@Entity('invoice')
@Index(['corpId', 'status'])
@Index(['orderId'])
@Index(['invoiceNo'])
export class InvoiceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'order_id', type: 'bigint', unsigned: true, comment: '订单ID' })
  orderId: number;

  @Column({ name: 'invoice_no', type: 'varchar', length: 64, nullable: true, comment: '发票号码' })
  invoiceNo: string;

  @Column({ name: 'invoice_type', type: 'tinyint', comment: '发票类型: 1-普通发票 2-增值税专用发票' })
  invoiceType: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: '开票金额' })
  amount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, comment: '税额' })
  taxAmount: number;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 4, comment: '税率' })
  taxRate: number;

  // 购买方信息
  @Column({ name: 'buyer_name', type: 'varchar', length: 255, comment: '购买方名称' })
  buyerName: string;

  @Column({ name: 'buyer_tax_no', type: 'varchar', length: 64, comment: '购买方税号' })
  buyerTaxNo: string;

  @Column({ name: 'buyer_address', type: 'varchar', length: 255, nullable: true, comment: '购买方地址' })
  buyerAddress: string;

  @Column({ name: 'buyer_phone', type: 'varchar', length: 32, nullable: true, comment: '购买方电话' })
  buyerPhone: string;

  @Column({ name: 'buyer_bank', type: 'varchar', length: 255, nullable: true, comment: '购买方开户行' })
  buyerBank: string;

  @Column({ name: 'buyer_account', type: 'varchar', length: 64, nullable: true, comment: '购买方账号' })
  buyerAccount: string;

  @Column({ type: 'tinyint', default: 1, comment: '状态: 1-待开票 2-已开票 3-已作废' })
  status: number;

  @Column({ name: 'issue_time', type: 'datetime', nullable: true, comment: '开票时间' })
  issueTime: Date;

  @Column({ name: 'invoice_url', type: 'varchar', length: 500, nullable: true, comment: '发票文件URL' })
  invoiceUrl: string;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

