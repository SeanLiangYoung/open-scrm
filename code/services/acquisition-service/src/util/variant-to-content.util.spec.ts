import { describe, expect, it } from 'vitest';
import { mapVariantToContentDraft } from './variant-to-content.util';

describe('mapVariantToContentDraft', () => {
  it('maps variant fields to acquisition content draft defaults', () => {
    const draft = mapVariantToContentDraft({
      corpId: 1,
      accountId: 9,
      platform: 'xiaohongshu',
      contentType: 1,
      createUserId: 2,
      variant: {
        channel: 'xhs_graphic',
        title: '标题',
        body: '正文内容',
        structured: { tags: ['AI', '创作'] },
      },
    });

    expect(draft).toEqual({
      corpId: 1,
      accountId: 9,
      platform: 'xiaohongshu',
      contentType: 1,
      title: '标题',
      content: '正文内容',
      topics: ['AI', '创作'],
      status: 0,
      createUserId: 2,
    });
  });
});
