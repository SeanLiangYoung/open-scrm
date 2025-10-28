import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('wework_config')
export class WeworkConfigEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'varchar', length: 100, unique: true, comment: '企业ID' })
  corpId: string;

  @Column({ name: 'corp_secret', type: 'varchar', length: 200, comment: '企业Secret' })
  corpSecret: string;

  @Column({ name: 'agent_id', type: 'int', nullable: true, comment: '应用AgentID' })
  agentId: number;

  @Column({ name: 'contact_secret', type: 'varchar', length: 200, nullable: true, comment: '通讯录Secret' })
  contactSecret: string;

  @Column({ name: 'customer_secret', type: 'varchar', length: 200, nullable: true, comment: '客户联系Secret' })
  customerSecret: string;

  @Column({ name: 'callback_token', type: 'varchar', length: 100, nullable: true, comment: '回调Token' })
  callbackToken: string;

  @Column({ name: 'encoding_aes_key', type: 'varchar', length: 100, nullable: true, comment: '回调EncodingAESKey' })
  encodingAesKey: string;

  @Column({ type: 'tinyint', default: 1, comment: '0-禁用 1-启用' })
  status: number;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;
}

