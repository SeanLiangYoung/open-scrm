import { describe, expect, it } from 'vitest';
import { ChannelPromptRegistry } from './channel-prompt.registry';
import type { PromptSourceContext } from './channel-prompt.types';

const baseSource: PromptSourceContext = {
  title: 'AI 原生创作',
  body: '核心内容源正文',
  summary: '介绍 AI 原生创作中心',
  keywords: ['AI', '内容'],
  tone: '专业',
  targetAudience: '创作者',
  kbContext: '- [[wiki/concepts/ai.md]]: snippet about AI',
};

describe('ChannelPromptRegistry', () => {
  const registry = new ChannelPromptRegistry();

  it('builds tweet prompt with length constraint', () => {
    const prompt = registry.build('tweet', baseSource);

    expect(prompt.system).toContain('280');
    expect(prompt.user).toContain(baseSource.title);
    expect(prompt.user).toContain(baseSource.kbContext);
  });

  it('builds xhs_graphic prompt with title length constraint', () => {
    const prompt = registry.build('xhs_graphic', baseSource);

    expect(prompt.system).toContain('20');
    expect(prompt.user).toContain('tags');
  });

  it('throws for unsupported channel', () => {
    expect(() => registry.build('invalid' as 'tweet', baseSource)).toThrow(
      'Unsupported channel'
    );
  });
});
