import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('variant_publish_link')
@Index(['corpId', 'variantId'], { unique: true })
export class VariantPublishLinkEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId: number;

  @Column({ name: 'variant_id', type: 'bigint', unsigned: true })
  variantId: number;

  @Column({ name: 'content_id', type: 'bigint', unsigned: true })
  contentId: number;

  @Column({ type: 'varchar', length: 20 })
  platform: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}
