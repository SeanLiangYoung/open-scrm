import type { LlmAdapter, LlmCompletionRequest, LlmCompletionResult } from './llm.adapter';

export class MockLlmAdapter implements LlmAdapter {
  async complete(_request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    return {
      content: JSON.stringify({
        title: 'Mock 生成标题',
        body: 'Mock 生成正文，长度足够通过 ai_check 基础规则。',
        structured: {
          tags: ['mock'],
          bullets: ['要点一'],
          thread: ['Mock tweet line'],
          summary: 'Mock summary',
        },
      }),
    };
  }
}
