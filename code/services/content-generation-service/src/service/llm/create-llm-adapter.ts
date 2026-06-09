import type { LlmAdapter } from './llm.adapter';
import { OpenAiCompatibleLlmAdapter } from './llm.adapter';
import { MockLlmAdapter } from './mock-llm.adapter';

export function createLlmAdapter(config: {
  mockLlm: boolean;
  apiBase: string;
  apiKey: string;
  model: string;
  temperature?: number;
}): LlmAdapter {
  if (config.mockLlm) {
    return new MockLlmAdapter();
  }

  return new OpenAiCompatibleLlmAdapter({
    apiBase: config.apiBase,
    apiKey: config.apiKey,
    model: config.model,
    temperature: config.temperature,
  });
}
