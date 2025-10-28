import { Inject, Provide } from '@midwayjs/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@midwayjs/jwt';
import { UserEntity } from '../entity/user.entity';
import { PasswordUtil } from '../util/password.util';

@Provide()
export class AuthService {
  @InjectEntityModel(UserEntity)
  userRepo: Repository<UserEntity>;

  @Inject()
  jwtService: JwtService;

  @Inject()
  passwordUtil: PasswordUtil;

  /**
   * 用户登录
   */
  async login(username: string, password: string) {
    // 1. 查询用户
    const user = await this.userRepo.findOne({
      where: { username },
      select: ['id', 'username', 'password', 'corpId', 'status', 'isAdmin'],
      relations: ['roles']
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    if (user.status !== 1) {
      throw new Error('账号已被禁用');
    }

    // 2. 验证密码
    const isMatch = await this.passwordUtil.verifyPassword(password, user.password);

    if (!isMatch) {
      throw new Error('密码错误');
    }

    // 3. 生成Token
    const accessToken = await this.jwtService.sign({
      userId: user.id,
      corpId: user.corpId,
      username: user.username,
      isAdmin: user.isAdmin,
      roles: user.roles.map(r => r.roleCode)
    });

    const refreshToken = await this.jwtService.sign(
      {
        userId: user.id,
        type: 'refresh'
      },
      { expiresIn: '7d' }
    );

    // 4. 更新最后登录时间
    await this.userRepo.update(user.id, {
      lastLoginTime: new Date()
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        corpId: user.corpId,
        isAdmin: user.isAdmin
      }
    };
  }

  /**
   * 刷新Token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload: any = await this.jwtService.verify(refreshToken);

      if (payload.type !== 'refresh') {
        throw new Error('无效的刷新Token');
      }

      // 查询用户
      const user = await this.userRepo.findOne({
        where: { id: payload.userId },
        relations: ['roles']
      });

      if (!user || user.status !== 1) {
        throw new Error('用户不存在或已被禁用');
      }

      // 生成新Token
      const accessToken = await this.jwtService.sign({
        userId: user.id,
        corpId: user.corpId,
        username: user.username,
        isAdmin: user.isAdmin,
        roles: user.roles.map(r => r.roleCode)
      });

      return { accessToken };
    } catch (error) {
      throw new Error('Token刷新失败');
    }
  }

  /**
   * 验证Token
   */
  async verifyToken(token: string): Promise<any> {
    try {
      const payload = await this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new Error('Token无效');
    }
  }
}

