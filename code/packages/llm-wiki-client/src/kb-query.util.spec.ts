import { describe, expect, it } from 'vitest';
import { buildKbSearchQuery } from './kb-query.util';

describe('buildKbSearchQuery', () => {
  it('joins title and keywords into a single search string', () => {
    const query = buildKbSearchQuery({
      title: 'Rotary Position Embedding',
      keywords: ['RoPE', 'attention'],
    });

    expect(query).toBe('Rotary Position Embedding RoPE attention');
  });

  it('uses kbQuery override when provided', () => {
    const query = buildKbSearchQuery({
      title: 'Ignored title',
      keywords: ['ignored'],
      kbQuery: 'custom grounding query',
    });

    expect(query).toBe('custom grounding query');
  });

  it('returns empty string when no usable fields exist', () => {
    expect(buildKbSearchQuery({})).toBe('');
    expect(buildKbSearchQuery({ title: '   ', keywords: [] })).toBe('');
  });
});
