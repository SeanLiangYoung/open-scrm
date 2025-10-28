import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * SOP模板实体
 */
@Entity('sop_template')
export class SopTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'template_name', type: 'varchar', length: 100, comment: '模板名称' })
  templateName: string;

  @Column({ name: 'template_type', type: 'tinyint', comment: '模板类型: 1-客户SOP 2-群SOP' })
  templateType: number;

  @Column({ name: 'trigger_type', type: 'tinyint', comment: '触发类型: 1-添加好友 2-打标签 3-进群 4-手动触发' })
  triggerType: number;

  @Column({ name: 'trigger_condition', type: 'json', nullable: true, comment: '触发条件JSON' })
  triggerCondition: any;

  @Column({ type: 'text', nullable: true, comment: 'SOP描述' })
  description: string;

  @Column({ type: 'tinyint', default: 1, comment: '状态: 0-禁用 1-启用' })
  status: number;

  @Column({ name: 'create_user_id', type: 'bigint', unsigned: true, nullable: true, comment: '创建人ID' })
  createUserId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

