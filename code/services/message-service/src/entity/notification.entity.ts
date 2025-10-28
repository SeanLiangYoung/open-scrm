import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 站内通知实体
 */
@Entity('notification')
@Index(['userId', 'isRead'])
@Index(['corpId', 'createTime'])
export class NotificationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true, comment: '用户ID' })
  userId: number;

  @Column({ name: 'notification_type', type: 'tinyint', comment: '通知类型: 1-系统 2-业务 3-警告' })
  notificationType: number;

  @Column({ type: 'varchar', length: 200, comment: '通知标题' })
  title: string;

  @Column({ type: 'text', comment: '通知内容' })
  content: string;

  @Column({ name: 'link_url', type: 'varchar', length: 500, nullable: true, comment: '跳转链接' })
  linkUrl: string;

  @Column({ type: 'json', nullable: true, comment: '扩展数据' })
  extra: any;

  @Column({ name: 'is_read', type: 'tinyint', default: 0, comment: '是否已读: 0-未读 1-已读' })
  isRead: number;

  @Column({ name: 'read_time', type: 'datetime', nullable: true, comment: '阅读时间' })
  readTime: Date;

  @Column({ name: 'expire_time', type: 'datetime', nullable: true, comment: '过期时间' })
  expireTime: Date;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

