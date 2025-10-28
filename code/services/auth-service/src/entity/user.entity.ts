import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable
} from 'typeorm';
import { RoleEntity } from './role.entity';

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'corp_id', type: 'bigint', unsigned: true })
  corpId: number;

  @Column({ length: 50 })
  username: string;

  @Column({ length: 255, select: false })
  password: string;

  @Column({ name: 'real_name', length: 50, nullable: true })
  realName: string;

  @Column({ length: 20, nullable: true })
  mobile: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ length: 255, nullable: true })
  avatar: string;

  @Column({ name: 'wework_userid', length: 64, nullable: true })
  weworkUserid: string;

  @Column({ type: 'tinyint', default: 1 })
  status: number; // 0-禁用 1-正常

  @Column({ name: 'is_admin', type: 'tinyint', default: 0 })
  isAdmin: number;

  @Column({ name: 'last_login_time', nullable: true })
  lastLoginTime: Date;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ManyToMany(() => RoleEntity)
  @JoinTable({
    name: 'user_role',
    joinColumn: { name: 'user_id' },
    inverseJoinColumn: { name: 'role_id' }
  })
  roles: RoleEntity[];
}

