import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 内容实体
 */
@Entity('content')
@Index(['accountId', 'createTime'])
@Index(['corpId', 'status'])
export class ContentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'account_id', type: 'int', unsigned: true, comment: '平台账号ID' })
  accountId: number;

  @Column({ type: 'varchar', length: 20, comment: '平台' })
  platform: string;

  @Column({ name: 'content_type', type: 'smallint', comment: '内容类型: 1-图文 2-视频' })
  contentType: number;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '标题' })
  title: string | null;

  @Column({ type: 'text', nullable: true, comment: '内容' })
  content: string | null;

  @Column({ name: 'media_urls', type: 'json', nullable: true, comment: '媒体文件URLs' })
  mediaUrls: string[] | null;

  @Column({ name: 'cover_url', type: 'varchar', length: 255, nullable: true, comment: '封面URL' })
  coverUrl: string | null;

  @Column({ type: 'json', nullable: true, comment: '话题标签' })
  topics: string[] | null;

  @Column({ type: 'smallint', default: 0, comment: '状态: 0-草稿 1-已发布 2-失败' })
  status: number;

  @Column({ name: 'publish_time', type: 'timestamp', nullable: true, comment: '发布时间' })
  publishTime: Date | null;

  @Column({ name: 'platform_content_id', type: 'varchar', length: 100, nullable: true, comment: '平台内容ID' })
  platformContentId: string | null;

  @Column({ name: 'create_user_id', type: 'bigint', unsigned: true, nullable: true, comment: '创建人ID' })
  createUserId: number | null;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

