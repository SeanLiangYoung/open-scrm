import { Inject, Provide, httpError } from '@midwayjs/core';
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
  async login(username: string, password: string, corpId?: number) {
    if (
      typeof username !== 'string' ||
      !username.trim() ||
      typeof password !== 'string' ||
      password.length === 0 ||
      (corpId !== undefined && (!Number.isSafeInteger(corpId) || corpId < 1))
    ) {
      throw new httpError.BadRequestError('登录参数无效，企业编号须为正安全整数');
    }
    let user: UserEntity | null;
    if (corpId !== undefined) {
      user = await this.userRepo.findOne({
        where: { username, corpId },
        select: ['id', 'username', 'password', 'corpId', 'status', 'isAdmin'],
        relations: ['roles']
      });
    } else {
      const candidates = await this.userRepo.find({
        where: { username },
        select: ['id', 'username', 'password', 'corpId', 'status', 'isAdmin'],
        relations: ['roles'],
        order: { id: 'ASC' },
        take: 2
      });
      if (candidates.length > 1) {
        throw new httpError.BadRequestError('同名账号存在多个企业，请填写企业编号');
      }
      user = candidates[0] ?? null;
    }
    if (!user || user.status !== 1) {
      throw new httpError.UnauthorizedError('账号或密码错误');
    }
    const isMatch = await this.passwordUtil.verifyPassword(password, user.password);
    if (!isMatch) throw new httpError.UnauthorizedError('账号或密码错误');

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
    let payload: any;
    try {
      payload = await this.jwtService.verify(refreshToken);
    } catch {
      throw new httpError.UnauthorizedError('刷新凭证无效或已过期');
    }
    const id = payload?.userId;
    const validId =
      typeof id === 'number'
        ? Number.isSafeInteger(id) && id > 0
        : typeof id === 'string' && /^[1-9]\d*$/.test(id);
    if (payload?.type !== 'refresh' || !validId) {
      throw new httpError.UnauthorizedError('刷新凭证无效或已过期');
    }
    const user = await this.userRepo.findOne({
      where: { id: payload.userId },
      relations: ['roles']
    });
    if (!user || user.status !== 1) {
      throw new httpError.UnauthorizedError('刷新凭证无效或已过期');
    }
    const accessToken = await this.jwtService.sign({
      userId: user.id,
      corpId: user.corpId,
      username: user.username,
      isAdmin: user.isAdmin,
      roles: user.roles.map(r => r.roleCode)
    });
    return { accessToken };
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
