import { describe, expect, it } from 'vitest';
import { applyChannelPostProcess } from './channel-post-process.util';

describe('applyChannelPostProcess', () => {
  it('truncates xhs_graphic title to 20 chars and stores title candidates', () => {
    const result = applyChannelPostProcess('xhs_graphic', {
      title: '这是一个超过二十个字的小红书标题示例需要截断',
      body: '正文足够长，用于通过基础质检规则。',
      structured: { tags: ['AI'] },
    });

    expect(result.title?.length).toBeLessThanOrEqual(20);
    expect(result.structured?.titleCandidates).toEqual([result.title]);
  });

  it('adds hook to short_video_script when missing', () => {
    const result = applyChannelPostProcess('short_video_script', {
      title: '脚本标题',
      body: '前三秒要抓住用户注意力，这是完整口播正文。',
      structured: {},
    });

    expect(result.structured?.hook).toBe('前三秒要抓住用户注意力，这是完整口播正文。');
  });

  it('leaves tweet payload unchanged', () => {
    const input = {
      title: 'Tweet title',
      body: 'Tweet body long enough for checks.',
      structured: { thread: ['a'] },
    };

    expect(applyChannelPostProcess('tweet', input)).toEqual(input);
  });
});
