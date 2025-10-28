import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 每日统计实体
 */
@Entity('daily_stat')
@Index(['corpId', 'statDate'])
@Index(['statDate'])
export class DailyStatEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'stat_date', type: 'date', comment: '统计日期' })
  statDate: Date;

  // 客户相关统计
  @Column({ name: 'new_customer_count', type: 'int', default: 0, comment: '新增客户数' })
  newCustomerCount: number;

  @Column({ name: 'lost_customer_count', type: 'int', default: 0, comment: '流失客户数' })
  lostCustomerCount: number;

  @Column({ name: 'active_customer_count', type: 'int', default: 0, comment: '活跃客户数' })
  activeCustomerCount: number;

  @Column({ name: 'total_customer_count', type: 'int', default: 0, comment: '累计客户数' })
  totalCustomerCount: number;

  // 员工相关统计
  @Column({ name: 'active_staff_count', type: 'int', default: 0, comment: '活跃员工数' })
  activeStaffCount: number;

  @Column({ name: 'total_staff_count', type: 'int', default: 0, comment: '总员工数' })
  totalStaffCount: number;

  // 消息相关统计
  @Column({ name: 'message_send_count', type: 'int', default: 0, comment: '发送消息数' })
  messageSendCount: number;

  @Column({ name: 'message_success_count', type: 'int', default: 0, comment: '发送成功数' })
  messageSuccessCount: number;

  @Column({ name: 'message_fail_count', type: 'int', default: 0, comment: '发送失败数' })
  messageFailCount: number;

  // SOP相关统计
  @Column({ name: 'sop_execute_count', type: 'int', default: 0, comment: 'SOP执行次数' })
  sopExecuteCount: number;

  @Column({ name: 'sop_success_count', type: 'int', default: 0, comment: 'SOP成功次数' })
  sopSuccessCount: number;

  // 群发相关统计
  @Column({ name: 'mass_task_count', type: 'int', default: 0, comment: '群发任务数' })
  massTaskCount: number;

  @Column({ name: 'mass_send_count', type: 'int', default: 0, comment: '群发发送数' })
  massSendCount: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

