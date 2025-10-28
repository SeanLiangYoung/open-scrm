import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 素材实体
 */
@Entity('asset')
@Index(['corpId', 'type'])
@Index(['corpId', 'categoryId'])
@Index(['createTime'])
export class AssetEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'category_id', type: 'int', unsigned: true, nullable: true, comment: '分类ID' })
  categoryId: number;

  @Column({ type: 'varchar', length: 255, comment: '素材名称' })
  name: string;

  @Column({ type: 'tinyint', comment: '类型: 1-图片 2-视频 3-文件' })
  type: number;

  @Column({ name: 'file_url', type: 'varchar', length: 500, comment: '文件URL' })
  fileUrl: string;

  @Column({ name: 'file_size', type: 'bigint', default: 0, comment: '文件大小(字节)' })
  fileSize: number;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true, comment: 'MIME类型' })
  mimeType: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 500, nullable: true, comment: '缩略图URL' })
  thumbnailUrl: string;

  @Column({ type: 'int', default: 0, nullable: true, comment: '宽度(像素)' })
  width: number;

  @Column({ type: 'int', default: 0, nullable: true, comment: '高度(像素)' })
  height: number;

  @Column({ type: 'int', default: 0, nullable: true, comment: '时长(秒)' })
  duration: number;

  @Column({ type: 'json', nullable: true, comment: '标签' })
  tags: any;

  @Column({ name: 'use_count', type: 'int', default: 0, comment: '使用次数' })
  useCount: number;

  @Column({ name: 'create_user_id', type: 'bigint', unsigned: true, nullable: true, comment: '创建人ID' })
  createUserId: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

