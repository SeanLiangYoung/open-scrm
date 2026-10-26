import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Durable, expiring idempotency receipt; committed with the channel counter. */
@Entity('channel_scan_event')
@Index('uq_channel_scan_event_identity', ['corpId', 'channelCodeId', 'externalEventId'], { unique: true })
@Index('idx_channel_scan_event_expiry', ['expiresAt'])
export class ChannelScanEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string; // PostgreSQL BIGINT hydrates as an exact decimal string.

  @Column({ name: 'corp_id', type: 'bigint' })
  corpId: number;

  @Column({ name: 'channel_code_id', type: 'int' })
  channelCodeId: number;

  @Column({ name: 'external_event_id', type: 'varchar', length: 128 })
  externalEventId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
