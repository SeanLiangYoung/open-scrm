/**
 * 内容工坊 — 多平台生成渠道枚举
 */
export const CONTENT_CHANNEL = {
  SHORT_VIDEO_SCRIPT: 'short_video_script',
  LONG_VIDEO_SCRIPT: 'long_video_script',
  WECHAT_ARTICLE: 'wechat_article',
  XHS_GRAPHIC: 'xhs_graphic',
  TWEET: 'tweet',
  DOUYIN_CAPTION: 'douyin_caption',
} as const;

export type ContentChannel =
  (typeof CONTENT_CHANNEL)[keyof typeof CONTENT_CHANNEL];

export const CONTENT_CHANNEL_LIST: ContentChannel[] = Object.values(CONTENT_CHANNEL);

export function isContentChannel(value: string): value is ContentChannel {
  return (CONTENT_CHANNEL_LIST as string[]).includes(value);
}

export function assertContentChannels(channels: string[]): ContentChannel[] {
  const invalid = channels.filter(ch => !isContentChannel(ch));
  if (invalid.length > 0) {
    throw new Error(`Invalid content channels: ${invalid.join(', ')}`);
  }
  return channels as ContentChannel[];
}
