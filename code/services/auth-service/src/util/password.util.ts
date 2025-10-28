import { Provide, Config } from '@midwayjs/core';
import * as bcrypt from 'bcrypt';

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
    // 至少8位，包含大小写字母、数字和特殊字符
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!strongPasswordRegex.test(password)) {
      return {
        isValid: false,
        message: '密码至少8位，需包含大小写字母、数字和特殊字符'
      };
    }

    return { isValid: true, message: '密码强度合格' };
  }
}

