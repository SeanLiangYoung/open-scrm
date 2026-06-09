import { describe, expect, it } from 'vitest';
import { runAiCheck } from './ai-check.util';

describe('runAiCheck', () => {
  it('passes when title and body look publish-ready', () => {
    const result = runAiCheck({
      title: 'AI 原生创作中心',
      body: '这是一段足够长的正文，用于验证基础质检规则。',
    });

    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('fails when body is too short', () => {
    const result = runAiCheck({
      title: '标题',
      body: '太短',
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toContain('body_too_short');
  });

  it('fails when placeholder markers remain in generated copy', () => {
    const result = runAiCheck({
      title: 'TODO 标题',
      body: '正文里还有 placeholder 需要替换后再发布。',
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining(['placeholder_in_title', 'placeholder_in_body'])
    );
  });
});
