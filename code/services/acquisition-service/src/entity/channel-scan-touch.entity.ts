import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * 活码扫码归因占位行（广告 / UTM / RegionPack）；追加写入，供 E2E 与后续漏斗消费。
 */
@Entity('channel_scan_touch')
@Index(['corpId', 'channelCodeId', 'createTime'])
export class ChannelScanTouchEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId: number;

  @Column({ name: 'channel_code_id', type: 'int', unsigned: true })
  channelCodeId: number;

  @Column({ name: 'utm_campaign', type: 'varchar', length: 255, nullable: true })
  utmCampaign: string | null;

  @Column({ name: 'creative_id', type: 'varchar', length: 128, nullable: true })
  creativeId: string | null;

  @Column({ name: 'region_pack_id', type: 'varchar', length: 64, nullable: true })
  regionPackId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'create_time', type: 'timestamptz' })
  createTime: Date;
}
