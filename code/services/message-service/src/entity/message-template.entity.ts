import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 消息模板实体
 */
@Entity('message_template')
export class MessageTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'template_name', type: 'varchar', length: 100, comment: '模板名称' })
  templateName: string;

  @Column({ name: 'template_type', type: 'tinyint', comment: '模板类型: 1-文本 2-图片 3-链接 4-小程序 5-文件' })
  templateType: number;

  @Column({ name: 'message_type', type: 'tinyint', comment: '消息类型: 1-企业微信 2-站内通知 3-短信 4-邮件' })
  messageType: number;

  @Column({ type: 'text', comment: '模板内容' })
  content: string;

  @Column({ type: 'json', nullable: true, comment: '扩展字段JSON' })
  extra: any;

  @Column({ type: 'tinyint', default: 1, comment: '状态: 0-禁用 1-启用' })
  status: number;

  @Column({ name: 'create_user_id', type: 'bigint', unsigned: true, nullable: true, comment: '创建人ID' })
  createUserId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

