import { describe, it, expect } from 'vitest';
import { hasAttributionFields } from './channel-scan-touch-fields.util';

describe('hasAttributionFields', () => {
  it('空 dto 为 false', () => {
    expect(hasAttributionFields({})).toBe(false);
  });

  it('含 utm_campaign 为 true', () => {
    expect(hasAttributionFields({ utm_campaign: 'summer' })).toBe(true);
  });
});
