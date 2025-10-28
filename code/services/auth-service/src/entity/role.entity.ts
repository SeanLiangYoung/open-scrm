import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('role')
export class RoleEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId: number;

  @Column({ name: 'role_name', length: 50 })
  roleName: string;

  @Column({ name: 'role_code', length: 50 })
  roleCode: string;

  @Column({ length: 255, nullable: true })
  description: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;
}

