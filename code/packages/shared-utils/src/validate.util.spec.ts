import { describe, expect, it } from 'vitest';
import {
  getPasswordStrength,
  isValidEmail,
  isValidMobile,
} from './validate.util';

describe('validate.util', () => {
  it('isValidMobile', () => {
    expect(isValidMobile('13800138000')).toBe(true);
    expect(isValidMobile('123')).toBe(false);
  });

  it('isValidEmail', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });

  it('getPasswordStrength', () => {
    expect(getPasswordStrength('weak')).toBe(1);
    expect(getPasswordStrength('Abcd1234!@')).toBeGreaterThanOrEqual(2);
  });
});
