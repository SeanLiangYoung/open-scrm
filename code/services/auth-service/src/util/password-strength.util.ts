/**
 * Pure password policy check (unit-testable without Midway container).
 */
export function checkPasswordStrength(password: string): {
  isValid: boolean;
  message: string;
} {
  const strongPasswordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  if (!strongPasswordRegex.test(password)) {
    return {
      isValid: false,
      message: '密码至少8位，需包含大小写字母、数字和特殊字符',
    };
  }

  return { isValid: true, message: '密码强度合格' };
}
