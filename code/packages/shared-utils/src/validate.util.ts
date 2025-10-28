/**
 * 数据验证工具函数
 */

/**
 * 验证手机号
 * @param mobile 手机号
 */
export function isValidMobile(mobile: string): boolean {
  return /^1[3-9]\d{9}$/.test(mobile);
}

/**
 * 验证邮箱
 * @param email 邮箱
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * 验证身份证号
 * @param idCard 身份证号
 */
export function isValidIdCard(idCard: string): boolean {
  return /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/.test(idCard);
}

/**
 * 验证网址
 * @param url 网址
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证中文
 * @param str 字符串
 */
export function isChinese(str: string): boolean {
  return /^[\u4e00-\u9fa5]+$/.test(str);
}

/**
 * 验证字母和数字
 * @param str 字符串
 */
export function isAlphanumeric(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str);
}

/**
 * 验证密码强度
 * @param password 密码
 * @returns 强度等级: 1-弱, 2-中, 3-强
 */
export function getPasswordStrength(password: string): number {
  let strength = 0;

  // 长度检查
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;

  // 包含小写字母
  if (/[a-z]/.test(password)) strength++;

  // 包含大写字母
  if (/[A-Z]/.test(password)) strength++;

  // 包含数字
  if (/\d/.test(password)) strength++;

  // 包含特殊字符
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

  if (strength <= 2) return 1; // 弱
  if (strength <= 4) return 2; // 中
  return 3; // 强
}

/**
 * 验证是否为空
 * @param value 值
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 验证是否为数字
 * @param value 值
 */
export function isNumber(value: any): boolean {
  return !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * 验证是否为整数
 * @param value 值
 */
export function isInteger(value: any): boolean {
  return Number.isInteger(Number(value));
}

