import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 素材分类实体
 */
@Entity('asset_category')
@Index(['corpId'])
export class AssetCategoryEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'parent_id', type: 'int', unsigned: true, default: 0, comment: '父分类ID' })
  parentId: number;

  @Column({ type: 'varchar', length: 100, comment: '分类名称' })
  name: string;

  @Column({ type: 'int', default: 0, comment: '排序' })
  sort: number;

  @Column({ name: 'asset_count', type: 'int', default: 0, comment: '素材数量' })
  assetCount: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

