import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { AuthService } from '../service/auth.service';
import { Validate, Rule, RuleType } from '@midwayjs/validate';

/**
 * 登录DTO
 */
class LoginDto {
  @Rule(RuleType.string().required())
  username: string;

  @Rule(RuleType.string().required())
  password: string;
}

/**
 * 认证控制器
 */
@Controller('/api/v1/auth')
export class AuthController {
  @Inject()
  authService: AuthService;

  @Post('/login')
  @Validate()
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto.username, dto.password);
  }

  @Post('/refresh-token')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return await this.authService.refreshToken(refreshToken);
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

