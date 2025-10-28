import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('sync_log')
export class SyncLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'varchar', length: 100, comment: '企业ID' })
  corpId: string;

  @Column({ name: 'sync_type', type: 'varchar', length: 50, comment: '同步类型: contact/customer/message' })
  syncType: string;

  @Column({ type: 'tinyint', comment: '0-失败 1-成功 2-进行中' })
  status: number;

  @Column({ name: 'total_count', type: 'int', default: 0, comment: '总数' })
  totalCount: number;

  @Column({ name: 'success_count', type: 'int', default: 0, comment: '成功数' })
  successCount: number;

  @Column({ name: 'fail_count', type: 'int', default: 0, comment: '失败数' })
  failCount: number;

  @Column({ name: 'start_time', type: 'datetime', nullable: true, comment: '开始时间' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true, comment: '结束时间' })
  endTime: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true, comment: '错误信息' })
  errorMessage: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}

