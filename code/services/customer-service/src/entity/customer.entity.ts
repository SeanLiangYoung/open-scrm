import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { TagEntity } from './tag.entity';

@Entity('customer')
export class CustomerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId: number;

  @Column({ name: 'external_userid', type: 'varchar', length: 100, comment: '企微外部联系人ID' })
  externalUserid: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string;

  @Column({ type: 'tinyint', default: 1, comment: '1-微信 2-企微' })
  type: number;

  @Column({ type: 'tinyint', nullable: true, comment: '0-未知 1-男 2-女' })
  gender: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  unionid: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  province: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  city: string;

  @Column({ name: 'follow_user_id', type: 'bigint', unsigned: true, nullable: true, comment: '跟进员工ID' })
  followUserId: number;

  @Column({ name: 'add_time', type: 'datetime', nullable: true })
  addTime: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '添加渠道' })
  channel: string;

  @Column({ type: 'tinyint', default: 1, comment: '0-已删除 1-正常 2-流失' })
  status: number;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  // 多对多关系：客户-标签
  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'customer_tag_relation',
    joinColumn: { name: 'customer_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: TagEntity[];
}

