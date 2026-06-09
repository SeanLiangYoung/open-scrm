import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('content_source')
@Index(['corpId', 'updateTime'])
export class ContentSourceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  body!: string | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  keywords!: string[] | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  tone!: string | null;

  @Column({ name: 'target_audience', type: 'varchar', length: 255, nullable: true })
  targetAudience!: string | null;

  @Column({ name: 'kb_enabled', type: 'boolean', default: false })
  kbEnabled!: boolean;

  @Column({ name: 'kb_query', type: 'varchar', length: 500, nullable: true })
  kbQuery!: string | null;

  @Column({ name: 'kb_project_id', type: 'varchar', length: 255, nullable: true })
  kbProjectId!: string | null;

  @Column({ name: 'kb_selected_paths', type: 'jsonb', default: () => "'[]'" })
  kbSelectedPaths!: string[];

  @Column({ name: 'kb_citations', type: 'jsonb', default: () => "'[]'" })
  kbCitations!: Array<{ path: string; title: string; snippet?: string }>;

  @Column({ name: 'compose_status', type: 'varchar', length: 20, default: 'draft' })
  composeStatus!: 'draft' | 'composed' | 'finalized';

  @Column({ name: 'create_user_id', type: 'bigint', unsigned: true, nullable: true })
  createUserId!: number | null;

  @CreateDateColumn({ name: 'create_time' })
  createTime!: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime!: Date;
}
