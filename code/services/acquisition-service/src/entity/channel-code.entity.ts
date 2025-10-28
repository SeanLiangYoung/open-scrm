import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 渠道活码实体
 */
@Entity('channel_code')
@Index(['corpId', 'channel'])
export class ChannelCodeEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ name: 'code_name', type: 'varchar', length: 100, comment: '活码名称' })
  codeName: string;

  @Column({ type: 'varchar', length: 50, comment: '渠道标识' })
  channel: string;

  @Column({ name: 'qr_code_url', type: 'varchar', length: 255, nullable: true, comment: '二维码URL' })
  qrCodeUrl: string;

  @Column({ name: 'config_id', type: 'varchar', length: 100, nullable: true, comment: '企微配置ID' })
  configId: string;

  @Column({ name: 'staff_ids', type: 'json', nullable: true, comment: '分配员工IDs' })
  staffIds: any;

  @Column({ name: 'welcome_msg', type: 'text', nullable: true, comment: '欢迎语' })
  welcomeMsg: string;

  @Column({ name: 'auto_tag_ids', type: 'json', nullable: true, comment: '自动打标签IDs' })
  autoTagIds: any;

  @Column({ name: 'scan_count', type: 'int', default: 0, comment: '扫码次数' })
  scanCount: number;

  @Column({ name: 'add_count', type: 'int', default: 0, comment: '添加客户数' })
  addCount: number;

  @Column({ type: 'tinyint', default: 1, comment: '状态: 0-禁用 1-启用' })
  status: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

