import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * 素材使用记录实体
 */
@Entity('asset_usage')
@Index(['assetId', 'createTime'])
@Index(['corpId', 'createTime'])
export class AssetUsageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'asset_id', type: 'bigint', unsigned: true, comment: '素材ID' })
  assetId: number;

  @Column({ name: 'use_type', type: 'varchar', length: 50, comment: '使用类型: message/sop/mass_task' })
  useType: string;

  @Column({ name: 'ref_id', type: 'bigint', unsigned: true, nullable: true, comment: '关联ID' })
  refId: number;

  @Column({ name: 'use_user_id', type: 'bigint', unsigned: true, nullable: true, comment: '使用人ID' })
  useUserId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}

