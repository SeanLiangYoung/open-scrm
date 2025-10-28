import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 渠道统计实体
 */
@Entity('channel_stat')
@Index(['corpId', 'channel', 'statDate'])
export class ChannelStatEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ type: 'varchar', length: 50, comment: '渠道标识' })
  channel: string;

  @Column({ name: 'stat_date', type: 'date', comment: '统计日期' })
  statDate: Date;

  // 获客统计
  @Column({ name: 'scan_count', type: 'int', default: 0, comment: '扫码次数' })
  scanCount: number;

  @Column({ name: 'add_customer_count', type: 'int', default: 0, comment: '添加客户数' })
  addCustomerCount: number;

  @Column({ name: 'conversion_rate', type: 'decimal', precision: 5, scale: 2, default: 0, comment: '转化率(%)' })
  conversionRate: number;

  // 留存统计
  @Column({ name: 'retention_1d', type: 'int', default: 0, comment: '1日留存' })
  retention1d: number;

  @Column({ name: 'retention_7d', type: 'int', default: 0, comment: '7日留存' })
  retention7d: number;

  @Column({ name: 'retention_30d', type: 'int', default: 0, comment: '30日留存' })
  retention30d: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

