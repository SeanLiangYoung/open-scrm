import { Provide, Config } from '@midwayjs/core';
import * as bcrypt from 'bcrypt';
import { checkPasswordStrength } from './password-strength.util';

@Provide()
export class PasswordUtil {
  @Config('bcrypt.saltRounds')
  saltRounds: number;

  /**
   * 哈希密码
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds || 12);
  }

  /**
   * 验证密码
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * 检查密码强度
   */
  checkPasswordStrength(password: string): {
    isValid: boolean;
    message: string;
  } {
    return checkPasswordStrength(password);
  }
}
