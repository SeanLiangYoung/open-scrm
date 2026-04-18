import { describe, expect, it } from 'vitest';
import { checkPasswordStrength } from './password-strength.util';

describe('checkPasswordStrength', () => {
  it('rejects weak passwords', () => {
    const r = checkPasswordStrength('short');
    expect(r.isValid).toBe(false);
  });

  it('accepts strong passwords', () => {
    const r = checkPasswordStrength('Admin@123');
    expect(r.isValid).toBe(true);
  });
});
