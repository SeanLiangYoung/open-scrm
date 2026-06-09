import { describe, expect, it } from 'vitest';
import { MockLlmAdapter } from './mock-llm.adapter';

describe('MockLlmAdapter', () => {
  it('returns valid JSON content without calling external APIs', async () => {
    const adapter = new MockLlmAdapter();
    const result = await adapter.complete({
      system: 'test',
      user: 'Write a tweet thread from this core source',
    });

    const parsed = JSON.parse(result.content) as { title: string; body: string };
    expect(parsed.title.length).toBeGreaterThan(0);
    expect(parsed.body.length).toBeGreaterThanOrEqual(10);
  });
});
