import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('customer_follow_up')
@Index('idx_customer_follow_up_corp_customer_time', ['corpId', 'customerId', 'createTime'])
export class FollowUpEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId: number;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  @Column({ name: 'follow_type', type: 'smallint', default: 1, comment: '1-电话 2-微信 3-面访 4-其他' })
  followType: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'next_follow_time', type: 'timestamp', nullable: true })
  nextFollowTime: Date | null;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}
