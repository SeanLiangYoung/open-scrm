import { describe, it, expect } from 'vitest';
import { COD_MOCK_STATES, isCodMockState } from './cod-mock-state.util';

describe('cod-mock-state', () => {
  it('合法状态列表固定', () => {
    expect(COD_MOCK_STATES).toContain('intent');
    expect(COD_MOCK_STATES).toContain('delivered');
  });

  it('isCodMockState', () => {
    expect(isCodMockState('intent')).toBe(true);
    expect(isCodMockState('invalid')).toBe(false);
  });

});
