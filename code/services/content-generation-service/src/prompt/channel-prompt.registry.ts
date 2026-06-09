import type { ContentChannel } from '@scrm/shared-constants';
import type { ChannelPrompt, PromptSourceContext } from './channel-prompt.types';

export class ChannelPromptRegistry {
  build(channel: ContentChannel, source: PromptSourceContext): ChannelPrompt {
    const kbBlock = source.kbContext
      ? `\n\nKnowledge base context:\n${source.kbContext}`
      : '';

    const core = [
      `Title: ${source.title}`,
      source.summary ? `Summary: ${source.summary}` : '',
      source.body ? `Body:\n${source.body}` : '',
      source.keywords?.length ? `Keywords: ${source.keywords.join(', ')}` : '',
      source.tone ? `Tone: ${source.tone}` : '',
      source.targetAudience ? `Audience: ${source.targetAudience}` : '',
      kbBlock,
    ]
      .filter(Boolean)
      .join('\n');

    switch (channel) {
      case 'tweet':
        return {
          system:
            'You are a social copywriter. Return strict JSON: {"title":"","body":"","structured":{"thread":[]}}. Each tweet <= 280 chars.',
          user: `Write a tweet thread from this core source:\n${core}`,
        };
      case 'xhs_graphic':
        return {
          system:
            'You are a Xiaohongshu copywriter. Return strict JSON: {"title":"","body":"","structured":{"tags":[],"bullets":[]}}. Title <= 20 Chinese chars.',
          user: `Write a Xiaohongshu graphic post with tags from:\n${core}`,
        };
      case 'wechat_article':
        return {
          system:
            'You are a WeChat article writer. Return strict JSON: {"title":"","body":"","structured":{"summary":"","coverSuggestion":""}}.',
          user: `Write a WeChat article in Markdown from:\n${core}`,
        };
      case 'short_video_script':
      case 'long_video_script':
      case 'douyin_caption':
        return {
          system:
            'You are a video script writer. Return strict JSON: {"title":"","body":"","structured":{}}.',
          user: `Write channel ${channel} content from:\n${core}`,
        };
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }
}
