import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 员工统计实体
 */
@Entity('staff_stat')
@Index(['corpId', 'staffId', 'statDate'])
export class StaffStatEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true, comment: '员工ID' })
  staffId: number;

  @Column({ name: 'stat_date', type: 'date', comment: '统计日期' })
  statDate: Date;

  // 客户统计
  @Column({ name: 'customer_count', type: 'int', default: 0, comment: '客户总数' })
  customerCount: number;

  @Column({ name: 'new_customer_count', type: 'int', default: 0, comment: '新增客户数' })
  newCustomerCount: number;

  @Column({ name: 'lost_customer_count', type: 'int', default: 0, comment: '流失客户数' })
  lostCustomerCount: number;

  @Column({ name: 'active_customer_count', type: 'int', default: 0, comment: '活跃客户数' })
  activeCustomerCount: number;

  // 互动统计
  @Column({ name: 'message_send_count', type: 'int', default: 0, comment: '发送消息数' })
  messageSendCount: number;

  @Column({ name: 'message_reply_count', type: 'int', default: 0, comment: '回复消息数' })
  messageReplyCount: number;

  @Column({ name: 'reply_rate', type: 'decimal', precision: 5, scale: 2, default: 0, comment: '回复率(%)' })
  replyRate: number;

  // 任务统计
  @Column({ name: 'task_count', type: 'int', default: 0, comment: '任务总数' })
  taskCount: number;

  @Column({ name: 'task_completed_count', type: 'int', default: 0, comment: '完成任务数' })
  taskCompletedCount: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

