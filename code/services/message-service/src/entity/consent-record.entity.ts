import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 用户同意记录（营销 / 事务等目的）；Sprint 8 出海 Phase 1 最小表
 */
@Entity('consent_record')
@Index(['corpId', 'subjectType', 'subjectId', 'purpose'])
export class ConsentRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId: number;

  @Column({ name: 'subject_type', type: 'varchar', length: 32 })
  subjectType: string;

  @Column({ name: 'subject_id', type: 'bigint', unsigned: true })
  subjectId: number;

  @Column({ type: 'varchar', length: 32 })
  purpose: string;

  @Column({ name: 'policy_version', type: 'varchar', length: 64, nullable: true })
  policyVersion: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  locale: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
