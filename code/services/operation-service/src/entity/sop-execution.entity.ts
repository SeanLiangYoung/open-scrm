import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * SOP执行记录实体
 */
@Entity('sop_execution')
@Index(['templateId', 'status'])
@Index(['customerId'])
@Index(['groupId'])
export class SopExecutionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'template_id', type: 'int', unsigned: true, comment: 'SOP模板ID' })
  templateId: number;

  @Column({ name: 'template_name', type: 'varchar', length: 100, nullable: true, comment: 'SOP模板名称' })
  templateName: string;

  @Column({ name: 'target_type', type: 'tinyint', comment: '目标类型: 1-客户 2-群' })
  targetType: number;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true, nullable: true, comment: '客户ID' })
  customerId: number;

  @Column({ name: 'group_id', type: 'bigint', unsigned: true, nullable: true, comment: '群ID' })
  groupId: number;

  @Column({ name: 'current_step', type: 'int', default: 0, comment: '当前步骤' })
  currentStep: number;

  @Column({ name: 'total_steps', type: 'int', default: 0, comment: '总步骤数' })
  totalSteps: number;

  @Column({ type: 'tinyint', default: 0, comment: '状态: 0-执行中 1-已完成 2-已暂停 3-已失败' })
  status: number;

  @Column({ name: 'start_time', type: 'datetime', nullable: true, comment: '开始时间' })
  startTime: Date;

  @Column({ name: 'complete_time', type: 'datetime', nullable: true, comment: '完成时间' })
  completeTime: Date;

  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true, comment: '错误信息' })
  errorMessage: string;

  @Column({ name: 'execution_log', type: 'json', nullable: true, comment: '执行日志JSON' })
  executionLog: any;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

