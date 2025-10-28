import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 群发任务实体
 */
@Entity('mass_task')
@Index(['corpId', 'createTime'])
@Index(['status'])
export class MassTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'task_name', type: 'varchar', length: 100, comment: '任务名称' })
  taskName: string;

  @Column({ name: 'task_type', type: 'tinyint', comment: '任务类型: 1-群发消息 2-批量打标签 3-批量分配' })
  taskType: number;

  @Column({ name: 'target_type', type: 'tinyint', comment: '目标类型: 1-客户 2-员工 3-群' })
  targetType: number;

  @Column({ name: 'target_ids', type: 'json', comment: '目标ID列表JSON' })
  targetIds: any;

  @Column({ name: 'target_count', type: 'int', default: 0, comment: '目标数量' })
  targetCount: number;

  @Column({ name: 'message_content', type: 'text', nullable: true, comment: '消息内容' })
  messageContent: string;

  @Column({ name: 'message_type', type: 'tinyint', nullable: true, comment: '消息类型' })
  messageType: number;

  @Column({ name: 'action_data', type: 'json', nullable: true, comment: '操作数据JSON' })
  actionData: any;

  @Column({ name: 'scheduled_time', type: 'datetime', nullable: true, comment: '计划执行时间' })
  scheduledTime: Date;

  @Column({ type: 'tinyint', default: 0, comment: '状态: 0-待执行 1-执行中 2-已完成 3-已失败 4-已取消' })
  status: number;

  @Column({ name: 'success_count', type: 'int', default: 0, comment: '成功数量' })
  successCount: number;

  @Column({ name: 'fail_count', type: 'int', default: 0, comment: '失败数量' })
  failCount: number;

  @Column({ name: 'start_time', type: 'datetime', nullable: true, comment: '开始执行时间' })
  startTime: Date;

  @Column({ name: 'complete_time', type: 'datetime', nullable: true, comment: '完成时间' })
  completeTime: Date;

  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true, comment: '错误信息' })
  errorMessage: string;

  @Column({ name: 'create_user_id', type: 'bigint', unsigned: true, nullable: true, comment: '创建人ID' })
  createUserId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

