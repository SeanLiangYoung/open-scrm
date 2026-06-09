import { describe, expect, it } from 'vitest';
import {
  CONTENT_CHANNEL,
  assertContentChannels,
  isContentChannel,
} from './content-channel';

describe('content-channel', () => {
  it('isContentChannel accepts known channel ids', () => {
    expect(isContentChannel(CONTENT_CHANNEL.TWEET)).toBe(true);
    expect(isContentChannel(CONTENT_CHANNEL.XHS_GRAPHIC)).toBe(true);
    expect(isContentChannel('not-a-channel')).toBe(false);
  });

  it('assertContentChannels returns typed channels or throws', () => {
    expect(assertContentChannels(['tweet', 'xhs_graphic'])).toEqual([
      'tweet',
      'xhs_graphic',
    ]);
    expect(() => assertContentChannels(['tweet', 'invalid'])).toThrow(
      'Invalid content channels: invalid'
    );
  });
});
