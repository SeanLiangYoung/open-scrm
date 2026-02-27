import { Inject, Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Like } from 'typeorm';
import { UserEntity } from '../entity/user.entity';
import { RoleEntity } from '../entity/role.entity';
import { PasswordUtil } from '../util/password.util';

@Provide()
export class UserService {
  @InjectEntityModel(UserEntity)
  userRepo: Repository<UserEntity>;

  @InjectEntityModel(RoleEntity)
  roleRepo: Repository<RoleEntity>;

  @Inject()
  passwordUtil: PasswordUtil;

  async createUser(data: {
    username: string;
    password: string;
    corpId: number;
    realName?: string;
    mobile?: string;
    email?: string;
  }) {
    const existing = await this.userRepo.findOne({
      where: { username: data.username, corpId: data.corpId },
    });
    if (existing) {
      throw new Error('用户名已存在');
    }

    const hashedPassword = await this.passwordUtil.hashPassword(data.password);

    const user = this.userRepo.create({
      ...data,
      password: hashedPassword,
      status: 1,
      isAdmin: 0,
    });

    const saved = await this.userRepo.save(user);
    const { password: _pwd, ...result } = saved as any;
    return result;
  }

  async listUsers(page: number, pageSize: number, keyword?: string) {
    const where: any = {};
    if (keyword) {
      where.username = Like(`%${keyword}%`);
    }

    const [items, total] = await this.userRepo.findAndCount({
      where,
      relations: ['roles'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { id: 'DESC' },
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUserById(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (!user) {
      throw new Error('用户不存在');
    }
    return user;
  }

  async updateUser(
    id: number,
    data: { realName?: string; mobile?: string; email?: string; status?: number }
  ) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new Error('用户不存在');
    }
    await this.userRepo.update(id, data);
    return await this.getUserById(id);
  }

  async deleteUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new Error('用户不存在');
    }
    if (user.isAdmin === 1) {
      throw new Error('无法删除管理员用户');
    }
    await this.userRepo.delete(id);
    return { message: '删除成功' };
  }

  async resetPassword(id: number, newPassword: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new Error('用户不存在');
    }
    const hashedPassword = await this.passwordUtil.hashPassword(newPassword);
    await this.userRepo.update(id, { password: hashedPassword });
    return { message: '密码重置成功' };
  }

  async assignRoles(userId: number, roleIds: number[]) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['roles'],
    });
    if (!user) {
      throw new Error('用户不存在');
    }

    const roles = await this.roleRepo.findByIds(roleIds);
    user.roles = roles;
    await this.userRepo.save(user);
    return await this.getUserById(userId);
  }
}
