import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 平台账号实体
 */
@Entity('platform_account')
@Index(['corpId', 'platform'])
export class PlatformAccountEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true, comment: '企业ID' })
  corpId: number;

  @Column({ type: 'varchar', length: 20, comment: '平台: douyin/xiaohongshu' })
  platform: string;

  @Column({ name: 'account_name', type: 'varchar', length: 100, nullable: true, comment: '账号名称' })
  accountName: string;

  @Column({ name: 'account_id', type: 'varchar', length: 100, nullable: true, comment: '平台账号ID' })
  accountId: string;

  @Column({ name: 'access_token', type: 'varchar', length: 500, nullable: true, comment: '访问令牌' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'varchar', length: 500, nullable: true, comment: '刷新令牌' })
  refreshToken: string;

  @Column({ name: 'expires_time', type: 'datetime', nullable: true, comment: '过期时间' })
  expiresTime: Date;

  @Column({ type: 'tinyint', default: 1, comment: '状态: 0-禁用 1-启用 2-已过期' })
  status: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

