import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * 消息发送日志实体
 */
@Entity('message_log')
@Index(['corpId', 'createTime'])
@Index(['targetType', 'targetId'])
export class MessageLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'template_id', type: 'int', unsigned: true, nullable: true, comment: '模板ID' })
  templateId: number;

  @Column({ name: 'message_type', type: 'smallint', comment: '消息类型: 1-企业微信 2-站内通知 3-短信 4-邮件' })
  messageType: number;

  @Column({ name: 'target_type', type: 'smallint', comment: '接收方类型: 1-客户 2-员工 3-群' })
  targetType: number;

  @Column({ name: 'target_id', type: 'bigint', unsigned: true, comment: '接收方ID' })
  targetId: number;

  @Column({ name: 'target_name', type: 'varchar', length: 100, nullable: true, comment: '接收方名称' })
  targetName: string;

  @Column({ type: 'text', comment: '消息内容' })
  content: string;

  @Column({ type: 'json', nullable: true, comment: '扩展数据' })
  extra: any;

  @Column({ name: 'send_status', type: 'smallint', default: 0, comment: '发送状态: 0-待发送 1-发送成功 2-发送失败' })
  sendStatus: number;

  @Column({ name: 'send_time', type: 'timestamp', nullable: true, comment: '发送时间' })
  sendTime: Date;

  @Column({ name: 'fail_reason', type: 'varchar', length: 500, nullable: true, comment: '失败原因' })
  failReason: string;

  @Column({ name: 'retry_count', type: 'int', default: 0, comment: '重试次数' })
  retryCount: number;

  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true, comment: '第三方消息ID' })
  externalId: string;

  /** Sprint 3：与 corp_id 联合唯一（见 DB 部分唯一索引）；单接收方发送幂等 */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 128, nullable: true, comment: '幂等键（可选）' })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}

