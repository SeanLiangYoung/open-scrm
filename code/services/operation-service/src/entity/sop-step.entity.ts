import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

/**
 * SOP步骤实体
 */
@Entity('sop_step')
@Index(['templateId', 'stepOrder'])
export class SopStepEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'template_id', type: 'int', unsigned: true, comment: 'SOP模板ID' })
  templateId: number;

  @Column({ name: 'step_order', type: 'int', comment: '步骤顺序' })
  stepOrder: number;

  @Column({ name: 'step_name', type: 'varchar', length: 100, comment: '步骤名称' })
  stepName: string;

  @Column({ name: 'step_type', type: 'tinyint', comment: '步骤类型: 1-发消息 2-打标签 3-推送素材 4-分配客户 5-提醒员工' })
  stepType: number;

  @Column({ name: 'delay_time', type: 'int', default: 0, comment: '延迟时间数值' })
  delayTime: number;

  @Column({ name: 'delay_unit', type: 'varchar', length: 10, default: 'minute', comment: '延迟单位: minute/hour/day' })
  delayUnit: string;

  @Column({ name: 'action_type', type: 'tinyint', nullable: true, comment: '动作类型' })
  actionType: number;

  @Column({ name: 'action_content', type: 'json', comment: '动作内容JSON' })
  actionContent: any;

  @Column({ type: 'tinyint', default: 1, comment: '状态: 0-禁用 1-启用' })
  status: number;
}

