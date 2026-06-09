import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('content_variant')
@Index(['jobId'])
@Index(['sourceId', 'channel'])
export class ContentVariantEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId!: number;

  @Column({ name: 'job_id', type: 'bigint', unsigned: true })
  jobId!: number;

  @Column({ name: 'source_id', type: 'bigint', unsigned: true })
  sourceId!: number;

  @Column({ type: 'varchar', length: 50 })
  channel!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  structured!: Record<string, unknown> | null;

  @Column({ name: 'quality_flags', type: 'jsonb', nullable: true })
  qualityFlags!: Record<string, unknown> | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime!: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime!: Date;
}
