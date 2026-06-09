import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type GenerationJobStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed';

@Entity('generation_job')
@Index(['sourceId', 'createTime'])
export class GenerationJobEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId!: number;

  @Column({ name: 'source_id', type: 'bigint', unsigned: true })
  sourceId!: number;

  @Column({ type: 'jsonb' })
  channels!: string[];

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: GenerationJobStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'llm_model', type: 'varchar', length: 100, nullable: true })
  llmModel!: string | null;

  @Column({ name: 'prompt_version', type: 'varchar', length: 50, nullable: true })
  promptVersion!: string | null;

  @Column({ name: 'kb_mode', type: 'varchar', length: 20, default: 'off' })
  kbMode!: string;

  @Column({ name: 'kb_hits', type: 'int', default: 0 })
  kbHits!: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime!: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime!: Date;
}
