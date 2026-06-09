import { describe, expect, it } from 'vitest';
import { createLlmAdapter } from './create-llm-adapter';
import { MockLlmAdapter } from './mock-llm.adapter';
import { OpenAiCompatibleLlmAdapter } from './llm.adapter';

describe('createLlmAdapter', () => {
  it('returns MockLlmAdapter when mock mode is enabled', () => {
    const adapter = createLlmAdapter({
      mockLlm: true,
      apiBase: '',
      apiKey: '',
      model: 'gpt-4o-mini',
    });

    expect(adapter).toBeInstanceOf(MockLlmAdapter);
  });

  it('returns OpenAiCompatibleLlmAdapter when mock mode is disabled', () => {
    const adapter = createLlmAdapter({
      mockLlm: false,
      apiBase: 'https://api.example.com/v1',
      apiKey: 'key',
      model: 'gpt-4o-mini',
    });

    expect(adapter).toBeInstanceOf(OpenAiCompatibleLlmAdapter);
  });
});
