import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { AuthService } from '../service/auth.service';
import { Validate, Rule, RuleType } from '@midwayjs/validate';

/**
 * 登录DTO
 */
export class LoginDto {
  @Rule(RuleType.string().required())
  username: string;

  @Rule(RuleType.string().required())
  password: string;

  @Rule(RuleType.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).strict().optional())
  corpId?: number;
}

export class RefreshTokenDto {
  @Rule(RuleType.string().strict().required())
  refreshToken: string;
}

/**
 * 认证控制器
 */
@Controller('/api/v1/auth')
export class AuthController {
  @Inject()
  authService: AuthService;

  @Post('/login')
  @Validate({ errorStatus: 400 })
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto.username, dto.password, dto.corpId);
  }

  @Post('/refresh-token')
  @Validate({ errorStatus: 400 })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return await this.authService.refreshToken(dto.refreshToken);
  }

  @Post('/verify-token')
  async verifyToken(@Body('token') token: string): Promise<any> {
    return await this.authService.verifyToken(token);
  }

  @Post('/logout')
  async logout() {
    // 客户端删除Token即可
    return { message: '登出成功' };
  }
}
