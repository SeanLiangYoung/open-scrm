import { describe, expect, it } from 'vitest';
import { buildCreateContentDtoFromVariant } from './push-draft.util';

describe('buildCreateContentDtoFromVariant', () => {
  it('builds acquisition create payload from variant and push options', () => {
    const dto = buildCreateContentDtoFromVariant(
      {
        title: 'XHS Title',
        body: 'Body text',
        structured: { tags: ['AI'] },
      },
      {
        platform: 'xiaohongshu',
        accountId: 3,
        contentType: 1,
      }
    );

    expect(dto).toEqual({
      accountId: 3,
      platform: 'xiaohongshu',
      contentType: 1,
      title: 'XHS Title',
      content: 'Body text',
      topics: ['AI'],
    });
  });
});
